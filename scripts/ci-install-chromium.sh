#!/usr/bin/env bash
# Installs Chromium for the E2E tests on CI without depending on the Ubuntu
# mirrors being up (issue #40):
#   1. the browser itself (Playwright's CDN, cached by actions/cache);
#   2. its system libraries via apt (`playwright install-deps`), each attempt
#      capped at ATTEMPT_TIMEOUT s with growing pauses — a dead mirror used to
#      hang ~10 min per try;
#   3. if apt keeps failing, carry on: GitHub's ubuntu-latest runners already
#      ship those libraries. The E2E step then proves whether it was enough.
# Prints which path ran as a workflow notice/warning.
set -uo pipefail

ATTEMPTS=${ATTEMPTS:-3}
ATTEMPT_TIMEOUT=${ATTEMPT_TIMEOUT:-180}
PAUSE=${PAUSE:-15}

npx playwright install chromium || exit 1

for i in $(seq 1 "$ATTEMPTS"); do
	if timeout "$ATTEMPT_TIMEOUT" npx playwright install-deps chromium; then
		echo "::notice title=Chromium::dependências de sistema instaladas pelo apt (tentativa $i)"
		exit 0
	fi
	echo "::warning title=Chromium::install-deps falhou (tentativa $i de $ATTEMPTS)"
	[ "$i" -lt "$ATTEMPTS" ] && sleep $((PAUSE * i))
done

echo "::warning title=Chromium::apt indisponível — a seguir com as bibliotecas que o runner já traz (sem install-deps)"
exit 0
