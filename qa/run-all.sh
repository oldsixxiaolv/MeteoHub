#!/usr/bin/env bash
# Run all qa tests in sequence and report.
set +e
cd "$(dirname "$0")"
FAIL=0; PASS=0
for t in test-*.js; do
    # These historical probes only print observations and contain no assertions.
    case "$t" in
        test-03b-focus-repro.js|test-03c-focus-debug.js|test-06-debug.js|test-09-typing-rebuild.js) continue ;;
    esac
    out=$(node "$t" 2>&1)
    code=$?
    if [ $code -eq 0 ]; then
        printf '%-40s PASS\n' "$t"
        PASS=$((PASS+1))
    else
        printf '%-40s FAIL (exit %d)\n' "$t" "$code"
        echo "    output:"
        echo "$out" | sed 's/^/    /'
        FAIL=$((FAIL+1))
    fi
done
echo "---"
echo "PASS=$PASS FAIL=$FAIL"
exit $FAIL