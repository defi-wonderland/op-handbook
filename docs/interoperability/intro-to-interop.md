---
id: intro-to-interop
title: Interop in a Nutshell
sidebar_label: Interop in a Nutshell
---

The Superchain is designed to be more than a set of sovereign rollups. It is meant to behave as a single logical network — horizontally scalable, low-latency, and capable of trust-minimized cross-chain coordination. Achieving this requires native interoperability.

In the OP Stack, interoperability means enabling a chain to consume the logs (events) of another chain as inputs to its own state transitions. When a contract emits an event on chain A, a contract on chain B can react to it with minimal latency — without routing through Ethereum L1.

This is not an L1 bridge abstraction. It’s a protocol-level messaging system built into the core consensus rules of the OP Stack. It enables arbitrary communication between chains with safety guarantees and fast finality, backed by an application-layer validity model and enforced via fork choice.

Motivation

Traditional rollup interoperability routes messages through Ethereum L1. This is secure, but costly and slow. Each message must be posted, proven, and finalized on L1 before another chain can act on it. This introduces a minimum latency of several minutes to hours.

OP Stack native interop removes this bottleneck. Instead of going through L1, messages flow directly between chains via the CrossL2Inbox. Safety is preserved by enforcing protocol invariants on message validity, and latency is minimized by allowing chains to act on messages immediately — as long as they satisfy those invariants.

This enables:
	•	Low-latency cross-chain apps (e.g. token transfers, atomic swaps, contract callbacks)
	•	Synchronous composability across chains
	•	Shared sequencing
	•	More scalable settlement architectures

High-Level Flow

A cross-chain message always involves two chains:
	•	Source Chain: Emits an event (log) representing the initiating message.
	•	Destination Chain: Consumes that event as input, producing an executing message.

The OP Stack does not use a relayer or inbox queue. Instead, the destination chain’s sequencer is expected to observe the source chain, extract logs, and include them as executing messages — if and only if they are valid.

Each message is identified by a deterministic Identifier struct:

```solidity
struct Identifier {
  address origin;
  uint256 blocknumber;
  uint256 logIndex;
  uint256 timestamp;
  uint256 chainid;
}
```

Validity Rules

A cross-chain message is only valid if it satisfies all messaging invariants:
	•	Timestamp invariant: The executing message’s timestamp must be ≥ the initiating message’s timestamp.
	•	Chain ID invariant: The source chain must be in the destination chain’s dependency set.
	•	Expiry invariant: The executing message must arrive within a bounded time window (e.g. 180 days) from the initiating message.

These invariants are enforced at the protocol level: blocks that include invalid executing messages are considered invalid and will be reorged out.

Dependency Sets

The dependency set is the list of chains a given chain is allowed to read from. Each chain defines its own dependency set — a mesh network topology where every chain in a cluster can consume logs from every other.

The chain’s own ID is always included in its dependency set. This enables low-cost consumption of its own logs without requiring block hash proofs.

The dependency set is stored in the node software and is treated as a network upgrade. Chains can be added, but not removed.
