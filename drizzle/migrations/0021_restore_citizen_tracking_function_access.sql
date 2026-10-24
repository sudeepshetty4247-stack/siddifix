-- Migration 0019 over-restricted EXECUTE on three citizen-facing security-definer
-- functions. They validate the private tracking token internally, so anonymous
-- execution is safe by design and required for citizen tracking/confirm/reopen.
GRANT EXECUTE ON FUNCTION public.verify_reporter_token(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_change_issue(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_civic_request(text, integer) TO anon, authenticated;