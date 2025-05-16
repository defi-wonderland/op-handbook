---
id: messaging-protocol
title: Messaging
sidebar_label: Messaging
---

:::info reference
This is a high level summary of how messaging works. We recommend you to read it, and after it go to the [OP Stack Specs about Messaging](https://specs.optimism.io/interop/messaging.html).
:::

Cross-chain messaging enables OP Chains to communicate directly, without routing messages through Ethereum. This low-latency communication is the foundation of Superchain interop. It powers cross-chain contract composition, token transfers, and native ETH bridging.

Each message consists of two parts:
- An **initiating message**: a log emitted on the source chain.
- An **executing message**: a log on the destination chain that confirms the initiating message.

A message is valid only if the executing message references a valid initiating message. This reference is encoded as an `Identifier` and enforced by a checksum. Validation is performed by the `CrossL2Inbox` contract, which emits an `ExecutingMessage` event on success.

## Messaging Flow

1. **Send a message**: A contract on the source chain calls `L2ToL2CrossDomainMessenger.sendMessage()`, emitting a log.

2. **Identify the message**: The log is uniquely identified by an `Identifier`:

   ```solidity
   struct Identifier {
     address origin;
     uint256 blocknumber;
     uint256 logIndex;
     uint256 timestamp;
     uint256 chainid;
   } 
    ```

3. Relay the message: A relayer calls `relayMessage()` on the destination chain. The call includes the Identifier and the message payload.
4. Validate the message: The destination chain uses `CrossL2Inbox.validateMessage()` to confirm the initiating message exists and that all invariants are satisfied.

If validation passes, the destination contract is called with the message payload. Otherwise, the transaction reverts.

## Messaging Invariants

The protocol enforces the following rules:
- **Chain ID Invariant**: The chainid in the Identifier must belong to the destination chain’s dependency set.
- **Timestamp Invariant**: The initiating message’s timestamp must be less than or equal to the executing message’s timestamp. It must also be greater than the Interop upgrade timestamp.
- **Expiry Invariant**: The executing message must be submitted within 180 days of the initiating message’s timestamp.

If any invariant is violated, the message is invalid. The block containing it is reverted or replaced.

### Emission vs. Execution View

Messages look different at emission and execution:

- On the **SRC chain**, the `L2ToL2CrossDomainMessenger` emits a log containing the `msgHash`, target address, destination chain, and payload. This log is indexed and uniquely identified by a struct called `Identifier`.

- On the **DST chain**, the transaction must include:
  - The `Identifier` (chain ID, timestamp, log index, block number, origin)
  - The `msgHash` (hash of the payload)
  - A valid checksum in the access list

These are validated by `CrossL2Inbox.validateMessage()` before the message can be executed.

### The node’s role in messaging

In the OP Stack, interoperability is driven by nodes. When a message is emitted on a source chain:
- The **relayer or sequencer node** watches for events from all chains in its dependency set.
- It stores the message metadata off-chain, including the `Identifier` and `msgHash`.
- When building a block on the destination chain, the node includes the message in a transaction’s **access list**, enabling `CrossL2Inbox` to validate it.

This means message passing in the Superchain is node-mediated. The EVM only enforces **local validation**, but the cross-chain part is coordinated by the **consensus node software**.

Interop only works if the node is configured to watch other chains, and knows how to validate their logs.

## Access Lists

Each executing message must be declared in a transaction’s access list. 

:::tip What’s an access list?
Access lists are part of the OP Stack’s message validation system. Each cross-chain message must be declared up front in a transaction’s access list so the block builder can verify its origin and integrity before including it in a block. This process is enforced outside the EVM using the `CrossL2Inbox`, and it ensures safety without slowing down execution.
:::

The access list entry includes:
- **Type 1**: Lookup identity (chain ID, block number, timestamp, log index)
- **Type 2**: Chain ID extension, only required for chains using 256-bit IDs (rare in current deployments)
- **Type 3**: Checksum over the initiating message and metadata

This metadata enables `CrossL2Inbox` to validate the message *without* querying remote chains or requiring proofs. Messages not listed in the access list will be rejected.

The checksum is derived as:

`logHash = keccak256(origin || msgHash)`

`idPacked = timestamp || blockNumber || log index`

`idLogHash = keccak256(logHash || idPacked)`

`bareChecksum = keccak256(idLogHash || chainId)`

`checksum = 0x03 || bareChecksum[1:]`

If the checksum is present and valid, the `CrossL2Inbox` allows the message to execute. This checksum must match the predeclared entry in the access list for validation to succeed.

:::tip Access list ≠ dependency set

The access list is per-transaction. It declares which message you’re consuming.

The dependency set is per-chain. It defines which source chains are trusted at all.

Both are required for message execution — the dependency set controls *who* you trust, and the access list controls *what* you’re trying to execute.
:::

## Message Payload

The message is serialized by concatenating its topics and data:

```solidity
msg := []byte{}
for _, topic := range log.Topics {
    msg = append(msg, topic.Bytes()...)
}
msg = append(msg, log.Data...)
```

This serialized payload is passed through `keccak256` and matched during execution. Contracts can decode it with abi.decode.

## Push and Pull Messaging

Interop supports both messaging models:
- **Push**: The source contract emits a message. A relayer submits it on the destination chain. Used by `L2ToL2CrossDomainMessenger`.
- **Pull**: An event is emitted on origin chain, and on destination, `validateMessage()` on `CrossL2Inbox` is called to verify and process it.

Use push messaging to trigger cross-chain contract execution. Use pull messaging to verify attestations or read logs emitted by other chains.

## Safety and the Message Graph

Messages form a directed graph of dependencies across blocks. A block that contains an executing message depends on the block that emitted the initiating message.

If the initiating message is invalid, the entire dependency chain becomes invalid. This includes:
- **Reorgs**: If a source block is reorged, its dependent messages and blocks become invalid.
- **Cycles**: Messages with the same timestamp across multiple chains can create valid cyclic dependencies.
- **Transitive dependencies**: A block is only cross-safe if all its ancestors and dependencies are cross-safe.

The verifier prunes blocks older than 2 * EXPIRY_TIME and filters out blocks with unsafe dependencies. This bounding prevents unbounded graph growth and enables efficient resolution.

## Security Considerations
- Chains can include each other in their dependency sets. This creates cycles. The protocol guarantees that unsafe blocks can still be promoted to safe even when cycles exist.
- Cross-chain message validity is transitive. If an initiating message depends on another unsafe message, the executing message is also unsafe.
- The system tolerates unsafe messages temporarily. They are valid only when all dependencies become cross-safe.

## TL;DR

Every executing message must:
- Prove that its initiating log exists
- Belong to a chain in the dependency set
- Pass timestamp and expiry validation
- Be listed in the access list with a valid checksum

Messages propagate trust-minimized state across chains with 1-block latency. Contracts can safely react to events emitted on remote OP Chains, without relying on Ethereum as a bridge.
