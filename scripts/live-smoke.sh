#!/usr/bin/env bash
set -uo pipefail
export RPC=http://127.0.0.1:8545

# No private keys are committed in this repo. anvil prints its deterministic
# dev key for account 0 at startup, so we read it from anvil's own output.
anvil --port 8545 >/tmp/chaupal-anvil.log 2>&1 &
ANVIL_PID=$!
trap 'kill $ANVIL_PID 2>/dev/null' EXIT
for _ in $(seq 1 40); do
  grep -q "Private Keys" /tmp/chaupal-anvil.log 2>/dev/null && break
  sleep 0.5
done
KEY0=$(awk '/Private Keys/{f=1; next} f && /^\(0\)/{sub(/^\(0\)[[:space:]]+/, ""); print; exit}' /tmp/chaupal-anvil.log)
if [ -z "$KEY0" ]; then
  echo "ERROR: could not read anvil account-0 private key from startup log" >&2
  exit 1
fi
echo "anvil account 0 key derived at runtime (not committed): ${KEY0:0:10}..."

STEWARDS=$(node -e "const d=require('./data/groups.json');console.log('['+d.groups.map(g=>g.steward).join(',')+']')")
ROOT0=$(node -e "console.log(require('./data/roots.json')['0'])")
PROOF0=$(node -e "const p=require('./data/proofs/group-0.json');const h=p[Object.keys(p)[0]];console.log('['+h.join(',')+']')")
MEMBER0=$(node -e "console.log(Object.keys(require('./data/proofs/group-0.json'))[0])")

DEPLOY=$(forge create src/ChaupalSeal.sol:ChaupalSeal \
  --broadcast --rpc-url $RPC --private-key $KEY0 --constructor-args "$STEWARDS")
CT=$(echo "$DEPLOY" | grep "Deployed to:" | awk '{print $3}')
echo "CONTRACT: $CT"

cast send $CT "setRoot(uint256,bytes32)" 0 $ROOT0 --private-key $KEY0 --rpc-url $RPC >/dev/null
echo "root stored: $(cast call $CT "rootOf(uint256)(bytes32)" 0 --rpc-url $RPC)"

echo "-- claim (member0 = steward0) --"
cast send $CT "claim(uint256,bytes32[])" 0 "$PROOF0" --private-key $KEY0 --rpc-url $RPC 2>&1 | grep -E "status|contractAddress" || true
echo "ownerOf(1):   $(cast call $CT "ownerOf(uint256)(address)" 1 --rpc-url $RPC)"
echo "isClaimed:    $(cast call $CT "isClaimed(uint256,address)(bool)" 0 $MEMBER0 --rpc-url $RPC)"
echo "groupOf(1):   $(cast call $CT "groupOf(uint256)(uint256)" 1 --rpc-url $RPC)"

echo "-- second claim reverts (expect error) --"
cast send $CT "claim(uint256,bytes32[])" 0 "$PROOF0" --private-key $KEY0 --rpc-url $RPC 2>&1 | grep -E "revert|AlreadyClaimed" | head -2 || true

echo "-- soulbound transfer reverts (expect error) --"
cast send $CT "transferFrom(address,address,uint256)" $MEMBER0 0x0000000000000000000000000000000000000002 1 --private-key $KEY0 --rpc-url $RPC 2>&1 | grep -E "revert|Soulbound" | head -2 || true