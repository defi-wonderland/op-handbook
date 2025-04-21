---
id: intro-to-interop
title: Interop in a Nutshell
sidebar_label: Interop in a Nutshell
---

The Superchain is a set of OP Stack chains that can communicate with each other. Interoperability is the ability of one chain to read and act on messages from another chain.

In OP, interop is built into the protocol. Chains should be able to emit logs, call initiating messages, and other chains should be able to consume them as inputs to their own transactions. **This does not require routing through Ethereum L1.**

The goal of native interop is to reduce latency. Instead of waiting for a message to be posted and finalized on L1, chains can interact directly. This enables fast, low-cost messaging and allows applications to coordinate across chains in near real-time.

## The Problem

Standard rollup interoperability depends on Ethereum L1. Messages are posted as L1 transactions, then proven, then finalized. This process is expensive and introduces delays.

Native interop solves this by allowing chains to read logs from each other without going through L1. Safety is enforced by checking a fixed set of message invariants. Latency depends only on the destination chain’s view of the source chain.

## The mental model

Interop is based on events. One chain emits an event. Another chain sees it and takes action.

Each cross-chain message has two parts:
- **Initiating message**: A log emitted on the source chain.
- **Executing message**: A log emitted on the destination chain, pointing to the initiating message.

The source chain emits the message. The destination chain consumes it. The message is identified by a struct called `Identifier`:

```solidity
struct Identifier {
  address origin;
  uint256 blocknumber;
  uint256 logIndex;
  uint256 timestamp;
  uint256 chainid;
}
```
This identifier is used to prove that the message exists and that it has not expired.

## Validity

A message can only be consumed if it is valid. There are three invariants:
- **Timestamp**: The initiating message must have a timestamp less than or equal to the executing message.
- **Chain ID**: The source chain must be in the destination chain’s dependency set.
- **Expiry**: The message must be consumed within a fixed time window after it is created. This window is currently set to 180 days.

If any of these invariants fail, the executing message is invalid. Any block that includes it will be reorged.

## Dependency Set

Each chain defines a list of chains it depends on. This list is called the dependency set.

If a chain is in your dependency set, you can read its logs. If it is not, you cannot consume its messages.

Dependency sets are configured in the client software. They are updated through governance or upgrade mechanisms. Chains can be added to the set, but not removed.

Every chain includes itself in its own dependency set. This allows it to read its own logs.