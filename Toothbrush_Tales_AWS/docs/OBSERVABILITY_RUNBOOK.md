# Observability Runbook (AWS)

## Purpose
Define minimum observability expectations for story generation and TTS in AWS.

## Structured Logs
- Story handler: `[Story] ...`
- TTS handler: `[Polly] ...`

## Dashboard Metrics to Track
- Story request failures (count)
- Story fallback rate
- TTS synthesis failures (count)
- Session funnel events (`session_start`, `session_pause`, `session_resume`, `session_stop`, `session_complete`)

## Alarm Recommendations
1. Story failure rate > 5% over 15m
2. TTS failure rate > 5% over 15m
3. Lambda p95 latency > 8s over 15m
4. Lambda error count > 0 for 3 consecutive periods

## Incident Steps
1. Check latest Lambda logs for `[Story]` or `[Polly]` errors.
2. Validate IAM access for Bedrock/Polly model/voice paths.
3. Confirm fallback behavior remains active (app still usable).
4. Roll back most recent backend change if failure is regression.
5. Record incident root cause and update this runbook.
