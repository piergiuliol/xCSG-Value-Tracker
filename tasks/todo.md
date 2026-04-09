# Phase 1 Backend Rewrite Checklist

- [x] Read FRAMEWORK.md and SPEC.md, inspect current backend schema/routes/metrics
- [x] Add v2 schema migration for projects and expert_responses
- [x] Update Pydantic models for project create/update and 27-field expert payload
- [x] Replace expert options with exact FRAMEWORK.md strings
- [x] Rewrite metrics for working days, quality score, outcome rate, productivity, and updated scorecards/dashboard
- [x] Update norms aggregates to use L1-L12 estimates and outlier flagging
- [x] Verify with Python compile, API smoke checks, and frontend syntax check

## Review
- Added database migrate_v2() for new projects and expert_responses columns while keeping old columns for compatibility.
- Updated models.py for working_days, engagement_revenue, revision_depth, and the new 27-field expert payload.
- Rewrote metrics.py to use working-day effort, quality composite, outcome-rate ratio, and productivity ratio while preserving flywheel metrics.
- Updated app.py expert options to exact V2 field keys/options and wired project/expert payloads to the new schema.
- Verified backend compile, frontend JS syntax, login, and expert options endpoint.
