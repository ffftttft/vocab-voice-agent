"""背词流程 REST API（SPEC 6.1）。"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..app_context import get_context
from ..harness.daily_planner import DailyPlanner
from ..services.study_service import (
    StudyError,
    get_study_queue,
    progress,
    stats_snapshot,
    submit_rating,
)
from ..services.wordbook_loader import WordbookError, import_wordbook

router = APIRouter(tags=["study"])


async def get_session(request: Request) -> AsyncSession:
    ctx = get_context(request.app)
    async with ctx.session_factory() as session:
        yield session


def _today() -> date:
    return date.today()


class ReviewCardRequest(BaseModel):
    word_id: int
    selected_label: str | None = None
    duration_ms: int = Field(default=0, ge=0)
    manual_rating: int | None = Field(default=None, ge=1, le=4)


@router.post("/wordbooks/import")
async def upload_wordbook(
    request: Request,
    file: UploadFile = File(...),
    book_name: str | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
) -> dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="上传文件为空")
    try:
        return await import_wordbook(session, content, file.filename or "upload.json", book_name)
    except WordbookError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/study/daily-plan")
async def create_daily_plan(
    request: Request,
    plan_date: date | None = None,
    regenerate: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """获取或生成今日学习计划。

    已存在且未要求重生成时直接返回，避免每次打开首页都烧一次 LLM 费用。
    """
    ctx = get_context(request.app)
    target = plan_date or _today()

    from sqlalchemy import func, select

    from ..db.models import DailyPlanItem
    from ..db.repos import get_or_create_plan

    existing = await session.scalar(
        select(func.count()).select_from(DailyPlanItem).where(DailyPlanItem.plan_date == target)
    )
    if existing and not regenerate:
        plan = await get_or_create_plan(session, target)
        return {
            "plan_date": target.isoformat(),
            "cached": True,
            "scenario_title": plan.scenario_title,
            "scenario_brief": plan.scenario_brief,
            "status": plan.status,
            "progress": await progress(session, target),
        }

    # provider 构造本身也可能失败（如未配置 API Key），必须在同一层捕获，
    # 否则用户看到的是裸 500 而不是可读的配置提示。
    try:
        planner = DailyPlanner(
            llm=ctx.registry.get_text_llm(),
            tts=ctx.registry.get_tts(),
            memory=ctx.memory,
            study_plan=ctx.config.study_plan,
        )
        result = await planner.generate_plan(session, target)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=(
                f"计划生成失败：{exc}. "
                "请检查 config.yaml / .env 中的模型配置（base_url、api_key、model_name）是否正确。"
            ),
        ) from exc

    return {
        "plan_date": target.isoformat(),
        "cached": False,
        "scenario_title": result.scenario_title,
        "scenario_brief": result.scenario_brief,
        "new_count": result.new_count,
        "review_count": result.review_count,
        "voice_target_count": result.voice_target_count,
        "audio_ready": result.audio_ready,
        "warnings": result.warnings,
        "progress": await progress(session, target),
    }


@router.get("/study/queue")
async def study_queue(
    request: Request,
    plan_date: date | None = None,
    include_done: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    target = plan_date or _today()
    queue = await get_study_queue(session, target, include_done=include_done)
    return {
        "plan_date": target.isoformat(),
        "progress": await progress(session, target),
        "cards": [
            {
                "item_id": c.item_id,
                "word_id": c.word_id,
                "word": c.word,
                "phonetic_us": c.phonetic_us,
                "item_type": c.item_type,
                "sentence_en": c.sentence_en,
                "sentence_zh": c.sentence_zh,
                "sentence_audio_path": c.sentence_audio_path,
                "options": c.options,
                "pos_defs": c.pos_defs,
                "is_voice_target": c.is_voice_target,
                "requeue_count": c.requeue_count,
            }
            for c in queue
        ],
    }


@router.post("/study/review-card")
async def review_card(
    request: Request,
    body: ReviewCardRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        return await submit_rating(
            session,
            plan_date=_today(),
            word_id=body.word_id,
            selected_label=body.selected_label,
            duration_ms=body.duration_ms,
            manual_rating=body.manual_rating,
        )
    except StudyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/study/stats")
async def study_stats(request: Request, session: AsyncSession = Depends(get_session)) -> dict:
    return await stats_snapshot(session)


@router.get("/study/words")
async def list_words(
    request: Request,
    tag: str | None = None,
    limit: int = 60,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """获取词库明细、FSRS 4 态统计与错题本数据，供 Lexicon Planet 与 Journal 消费。"""
    from sqlalchemy import select

    from ..db.models import DEFAULT_USER_ID, FSRSCard, LinguisticMistake, Word

    stmt = (
        select(Word, FSRSCard)
        .join(FSRSCard, FSRSCard.word_id == Word.id)
        .where(Word.user_id == DEFAULT_USER_ID)
        .order_by(Word.id.asc())
        .limit(limit)
    )
    rows = await session.execute(stmt)
    words_out = []
    for w, c in rows:
        tags = w.topic_tags or []
        if tag and tag != "all" and tag not in tags:
            continue
        words_out.append(
            {
                "id": w.id,
                "word": w.word,
                "phonetic_us": w.phonetic_us or "",
                "pos_defs": w.pos_defs or [],
                "topic_tags": tags,
                "book_name": w.book_name,
                "state": 0 if c.stability is None else c.state,
                "stability": round(c.stability, 1) if c.stability is not None else None,
                "difficulty": round(c.difficulty, 1) if c.difficulty is not None else None,
                "reps": c.reps or 0,
                "lapses": c.lapses or 0,
            }
        )

    mistakes_rows = await session.execute(
        select(LinguisticMistake)
        .where(LinguisticMistake.user_id == DEFAULT_USER_ID)
        .order_by(LinguisticMistake.id.desc())
        .limit(25)
    )
    mistakes_out = [
        {
            "id": m.id,
            "plan_date": m.plan_date.isoformat(),
            "mistake_type": m.mistake_type,
            "user_original": m.user_original,
            "corrected_version": m.corrected_version,
            "explanation": m.explanation or "",
        }
        for (m,) in mistakes_rows
    ]
    return {"words": words_out, "mistakes": mistakes_out}


@router.post("/study/seed-demo")
async def seed_demo_data(
    request: Request,
    reset: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """在本地尚未配置外部 LLM Key 或首次启动时，灌入真实 SQLite + FSRS 场景种子数据。"""
    from sqlalchemy import delete, func, select

    from ..db.models import (
        DEFAULT_USER_ID,
        PLAN_STUDYING,
        DailyPlanItem,
        DailyStudyPlan,
        FSRSCard,
        LinguisticMistake,
        Word,
    )
    from ..db.repos import add_words_with_cards

    target = _today()
    existing_items = await session.scalar(
        select(func.count())
        .select_from(DailyPlanItem)
        .where(DailyPlanItem.plan_date == target, DailyPlanItem.user_id == DEFAULT_USER_ID)
    )
    if existing_items and not reset:
        return {
            "seeded": False,
            "plan_date": target.isoformat(),
            "progress": await progress(session, target),
        }

    if reset:
        await session.execute(
            delete(DailyPlanItem).where(
                DailyPlanItem.plan_date == target, DailyPlanItem.user_id == DEFAULT_USER_ID
            )
        )
        await session.commit()

    def _opt(label: str, pos: str, text: str, is_correct: bool = False) -> dict:
        return {"label": label, "pos": pos, "text": text, "is_correct": is_correct}

    seed_entries = [
        {
            "word": "deprecate",
            "phonetic_us": "/ˈdeprəkeɪt/",
            "pos_defs": [{"pos": "v.", "def": "弃用；不赞成使用（旧接口或功能）"}],
            "topic_tags": ["tech_dev", "workplace_comm", "#API"],
            "item_type": "NEW",
            "is_voice_target": True,
            "sentence_en": (
                "We plan to deprecate the legacy webhook endpoint before Friday's "
                "release so clients migrate cleanly."
            ),
            "sentence_zh": "我们计划在周五发布前弃用旧版 Webhook 端点，以便客户端平滑迁移。",
            "options": [
                _opt("A", "v.", "部署；调配（微服务节点与资源）"),
                _opt("B", "v.", "弃用；不赞成使用（旧接口或功能）", True),
                _opt("C", "v.", "降级；削减（系统非核心权限）"),
                _opt("D", "v.", "委派；授权（底层调用任务）"),
            ],
        },
        {
            "word": "idempotent",
            "phonetic_us": "/ˌaɪdemˈpoʊtənt/",
            "pos_defs": [{"pos": "adj.", "def": "幂等的（多次执行结果一致）"}],
            "topic_tags": ["tech_dev", "problem_solving", "#Arch"],
            "item_type": "NEW",
            "is_voice_target": True,
            "sentence_en": (
                "Ensure the payment retry webhook handler is strictly idempotent "
                "so duplicate requests never double-charge."
            ),
            "sentence_zh": (
                "务必确保支付重试 Webhook 处理器是严格幂等的，防止重复请求造成二次扣款。"
            ),
            "options": [
                _opt("A", "adj.", "幂等的（多次请求产生相同副作用）", True),
                _opt("B", "adj.", "异步的（非阻塞并发执行）"),
                _opt("C", "adj.", "短暂的；临时的（生命周期极短）"),
                _opt("D", "adj.", "冗余的（用于故障切换备份）"),
            ],
        },
        {
            "word": "bottleneck",
            "phonetic_us": "/ˈbɑːtlnek/",
            "pos_defs": [{"pos": "n.", "def": "瓶颈；阻碍系统吞吐的关键环节"}],
            "topic_tags": ["tech_dev", "problem_solving", "#Perf"],
            "item_type": "REVIEW",
            "is_voice_target": True,
            "sentence_en": (
                "Connection pool contention became our primary database bottleneck "
                "during the flash sale spike."
            ),
            "sentence_zh": "在秒杀流量高峰期间，连接池争用成为了我们主要的数据库性能瓶颈。",
            "options": [
                _opt("A", "n.", "吞吐量；单位时间处理定额"),
                _opt("B", "n.", "瓶颈；限制整体性能的阻塞点", True),
                _opt("C", "n.", "快照；特定时间点的状态副本"),
                _opt("D", "n.", "载荷；传输协议中的核心数据"),
            ],
        },
        {
            "word": "ratify",
            "phonetic_us": "/ˈrætɪfaɪ/",
            "pos_defs": [{"pos": "v.", "def": "正式批准；签署确认（技术提案或协议）"}],
            "topic_tags": ["workplace_comm", "#Gov"],
            "item_type": "NEW",
            "is_voice_target": True,
            "sentence_en": (
                "All three staff engineers must ratify the schema migration RFC "
                "before we freeze the release branch."
            ),
            "sentence_zh": (
                "在冻结发布分支之前，三位主任工程师必须正式批准这份数据库迁移提案（RFC）。"
            ),
            "options": [
                _opt("A", "v.", "驳回；否决（不合规的变更请求）"),
                _opt("B", "v.", "重构；梳理（杂乱的遗留模块）"),
                _opt("C", "v.", "正式批准；签署确认（提案或协议）", True),
                _opt("D", "v.", "推迟；暂缓（非紧急功能上线）"),
            ],
        },
        {
            "word": "contingent",
            "phonetic_us": "/kənˈtɪndʒənt/",
            "pos_defs": [{"pos": "adj.", "def": "依条件而定的；取决于…的"}],
            "topic_tags": ["workplace_comm", "problem_solving", "#Contract"],
            "item_type": "NEW",
            "is_voice_target": True,
            "sentence_en": (
                "Friday's production rollout is contingent on passing the 10k-RPS "
                "chaos load test today."
            ),
            "sentence_zh": "周五的生产环境上线取决于今天能否通过每秒万级请求的混沌压测。",
            "options": [
                _opt("A", "adj.", "强制性的；不可跳过执行的"),
                _opt("B", "adj.", "依条件而定的；取决于…的", True),
                _opt("C", "adj.", "向后兼容的；不破坏旧版的"),
                _opt("D", "adj.", "立竿见影的；即时生效的"),
            ],
        },
        {
            "word": "ameliorate",
            "phonetic_us": "/əˈmiːliəreɪt/",
            "pos_defs": [{"pos": "v.", "def": "改善；缓解（糟糕的状况或高压负载）"}],
            "topic_tags": ["problem_solving", "tech_dev", "#Refactor"],
            "item_type": "REVIEW",
            "is_voice_target": True,
            "sentence_en": (
                "Adding a local Redis read-through cache helped ameliorate the "
                "tail latency on user profile queries."
            ),
            "sentence_zh": "增加一层本地 Redis 读穿透缓存，有效缓解了用户画像查询的长尾延迟。",
            "options": [
                _opt("A", "v.", "改善；缓解（不良状况或系统压力）", True),
                _opt("B", "v.", "加剧；恶化（原有的架构缺陷）"),
                _opt("C", "v.", "监控；追踪（分布式调用链路）"),
                _opt("D", "v.", "隔离；熔断（出现故障的下游节点）"),
            ],
        },
        {
            "word": "mitigate",
            "phonetic_us": "/ˈmɪtɪɡeɪt/",
            "pos_defs": [{"pos": "v.", "def": "减轻；缓和（风险、故障冲击）"}],
            "topic_tags": ["problem_solving", "tech_dev", "#Incident"],
            "item_type": "REVIEW",
            "is_voice_target": True,
            "sentence_en": (
                "We enabled rate-limiting at the edge gateway to mitigate the "
                "impact of the upstream timeout storm."
            ),
            "sentence_zh": "我们在边缘网关开启了限流，以减轻上游超时风暴带来的冲击。",
            "options": [
                _opt("A", "v.", "触发；引起（连锁故障反应）"),
                _opt("B", "v.", "减轻；缓和（故障影响或安全风险）", True),
                _opt("C", "v.", "审计；核查（历史访问日志）"),
                _opt("D", "v.", "枚举；遍历（所有可能的异常分支）"),
            ],
        },
        {
            "word": "ephemeral",
            "phonetic_us": "/ɪˈfemərəl/",
            "pos_defs": [{"pos": "adj.", "def": "短暂的；非持久化的（容器或临时存储）"}],
            "topic_tags": ["tech_dev", "daily_life", "#Cloud"],
            "item_type": "REVIEW",
            "is_voice_target": True,
            "sentence_en": (
                "Never store unbacked transaction logs on ephemeral container "
                "volumes that vanish on pod restart."
            ),
            "sentence_zh": "切勿将未备份的事务日志存储在容器重启即消失的临时卷上。",
            "options": [
                _opt("A", "adj.", "持久化的；写入磁盘保存的"),
                _opt("B", "adj.", "分布式的；跨机房多活部署的"),
                _opt("C", "adj.", "短暂的；非持久化的（随生命周期销毁）", True),
                _opt("D", "adj.", "高可用的；具备自动故障转移的"),
            ],
        },
    ]

    await add_words_with_cards(session, seed_entries, book_name="Core_3000_Engineer")
    await session.commit()

    brief_text = (
        "Dear Alex, today we are prepping for Friday’s architecture sync. "
        "Let’s anchor our key engineering terms and due reviews before our "
        "25-minute live call tonight."
    )
    plan = await session.get(DailyStudyPlan, {"plan_date": target, "user_id": DEFAULT_USER_ID})
    if plan is None:
        plan = DailyStudyPlan(
            plan_date=target,
            user_id=DEFAULT_USER_ID,
            scenario_title="Episode 14: Production Post-Mortem & API Deprecation",
            scenario_brief=brief_text,
            status=PLAN_STUDYING,
        )
        session.add(plan)
    else:
        plan.scenario_title = "Episode 14: Production Post-Mortem & API Deprecation"
        plan.scenario_brief = brief_text
        plan.status = PLAN_STUDYING

    word_rows = await session.execute(select(Word).where(Word.user_id == DEFAULT_USER_ID))
    word_map = {w.word: w for (w,) in word_rows}

    for idx, entry in enumerate(seed_entries):
        w = word_map.get(entry["word"])
        if not w:
            continue
        card = await session.get(FSRSCard, w.id)
        if card and entry["item_type"] == "REVIEW" and card.stability is None:
            card.stability = 8.4 + idx * 1.2
            card.difficulty = 4.6
            card.state = 2
            card.reps = 3

        existing_item = (
            await session.execute(
                select(DailyPlanItem).where(
                    DailyPlanItem.plan_date == target,
                    DailyPlanItem.user_id == DEFAULT_USER_ID,
                    DailyPlanItem.word_id == w.id,
                )
            )
        ).scalar_one_or_none()

        if existing_item is None:
            session.add(
                DailyPlanItem(
                    plan_date=target,
                    user_id=DEFAULT_USER_ID,
                    word_id=w.id,
                    item_type=entry["item_type"],
                    custom_sentence_en=entry["sentence_en"],
                    custom_sentence_zh=entry["sentence_zh"],
                    mcq_options=entry["options"],
                    card_done=False,
                    is_voice_target=entry["is_voice_target"],
                    order_index=idx,
                )
            )

    existing_mistakes = await session.scalar(
        select(func.count())
        .select_from(LinguisticMistake)
        .where(LinguisticMistake.user_id == DEFAULT_USER_ID)
    )
    if not existing_mistakes:
        session.add_all(
            [
                LinguisticMistake(
                    plan_date=target,
                    user_id=DEFAULT_USER_ID,
                    mistake_type="PRONUNCIATION",
                    user_original="we need to de-PRE-cate (/dɪˈprekeɪt/) the old API",
                    corrected_version="we need to deprecate (/ˈdeprəkeɪt/) the legacy endpoint",
                    explanation=(
                        "deprecate 重音在第一音节 /ˈdep/，注意不要读成 depreciate 的重音位置。"
                    ),
                ),
                LinguisticMistake(
                    plan_date=target,
                    user_id=DEFAULT_USER_ID,
                    mistake_type="GRAMMAR",
                    user_original="If the gateway would timeout, the webhook retries twice.",
                    corrected_version="If the gateway times out, the webhook retries twice.",
                    explanation=(
                        "条件从句描述高概率技术场景时使用一般现在时 times out，不用 would。"
                    ),
                ),
                LinguisticMistake(
                    plan_date=target,
                    user_id=DEFAULT_USER_ID,
                    mistake_type="WORD_CHOICE",
                    user_original="We must make sure the retry logic is no-repeat.",
                    corrected_version="We must ensure the retry handler is strictly idempotent.",
                    explanation="用专业架构词汇 idempotent（幂等的）替代口语化的 no-repeat。",
                ),
            ]
        )

    await session.commit()
    return {
        "seeded": True,
        "plan_date": target.isoformat(),
        "scenario_title": plan.scenario_title,
        "scenario_brief": plan.scenario_brief,
        "progress": await progress(session, target),
    }
