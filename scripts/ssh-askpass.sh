#!/usr/bin/env bash
# Askpass helper: OpenSSH calls this instead of prompting when
# SSH_ASKPASS=<this file> and SSH_ASKPASS_REQUIRE=force are set.
# It prints the password from the PRESSY_PASSWORD environment variable,
# so the secret never has to be typed or stored in the repo.
printf '%s\n' "${PRESSY_PASSWORD:?PRESSY_PASSWORD is not set}"
