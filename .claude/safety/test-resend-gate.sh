#!/bin/bash
# El gate de correo debe distinguir CONFIGURAR de ENVIAR.
# 0 = deja pasar, 2 = bloquea. Sin verbo de correo en el transcript.
G=/Users/alejandrodelcarpio/digital-polyglot-library/.claude/safety/pre-bash-guard.sh
R="api.resend.com"
fails=0

t() { # t <comando> <esperado> <descripción>
  local rc
  printf '{"tool_input":{"command":%s},"transcript_path":"/tmp/no-existe.jsonl"}' \
    "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")" | bash "$G" >/dev/null 2>&1
  rc=$?
  if [ "$rc" = "$2" ]; then printf 'ok    %s\n' "$3"
  else printf 'FALLO %s (esperado %s, dio %s)\n' "$3" "$2" "$rc"; fails=$((fails+1)); fi
}

# Configuración de la cuenta: no manda nada a nadie.
t "curl -s -X PATCH -H auth --data '{\"open_tracking\":true}' https://$R/domains/abc" 0 "PATCH /domains (tracking)"
t "curl -s -H auth https://$R/domains"                                                0 "GET /domains"
t "curl -s -H auth https://$R/api-keys"                                               0 "GET /api-keys"
# Lectura del estado de un correo ya enviado.
t "curl -s -H auth https://$R/emails/abc"                                             0 "GET /emails/<id>"
# Envío de verdad: sigue bloqueado.
t "curl -s -X POST -H auth --data '{\"to\":\"a@b.com\"}' https://$R/emails"            2 "POST /emails"
t "curl -s -X POST -H auth --data '{}' https://$R/emails/batch"                        2 "POST /emails/batch"
t "curl -s -X POST -H auth --data '{}' https://$R/broadcasts/x/send"                   2 "broadcast send"
# Un envío colado detrás de una configuración inocente.
t "curl -X PATCH --data '{}' https://$R/domains/abc && curl -X POST --data '{}' https://$R/emails" 2 "config + envío detrás"
# Los scripts que envían no heredan la exención.
t "npx tsx scripts/_inviteApplicantBeta.ts a@b.com"                                    2 "script de invitación"
t "npx tsx scripts/_runBetaTriage.ts"                                                  2 "script de triaje"

[ "$fails" = 0 ] && echo "TODO OK" || echo "$fails fallos"
exit "$fails"
