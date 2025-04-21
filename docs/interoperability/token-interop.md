---
id: token-interop
title: Token Interop
sidebar_label: Token Interop
---

:::info reference
This is a high-level summary of token interoperability in the Superchain. For full technical details, see the [SuperchainERC20 explainer](https://docs.optimism.io/interop/superchain-erc20) and the [Specs](https://specs.optimism.io/interop/token-bridging.html).
:::

Cross-chain token transfers in the Superchain are based on minting and burning, not wrapping or liquidity pools. The system uses two key components:

- `SuperchainERC20`: an ERC-20 extension with cross-chain mint and burn.
- `SuperchainTokenBridge`: a predeploy that handles message-based transfers.

This architecture enables fungibility across OP Chains with no liquidity fragmentation and 1-block latency.

## Overview

Each cross-chain transfer follows a simple flow:

**1. Burn** tokens on the source chain  
**2. Send** a message across chains  
**3. Mint** tokens on the destination chain

The process is secured by the OP Stack’s messaging protocol and enforced at the contract level.

## Contracts

| Contract | Role |
|---------|------|
| `SuperchainERC20` | Token interface. Adds `crosschainMint` and `crosschainBurn`. |
| `SuperchainTokenBridge` | Controls bridging logic. Only this contract can mint/burn. |
| `L2ToL2CrossDomainMessenger` | Message transport layer. |
| `CrossL2Inbox` | Verifies message validity. |

## SuperchainERC20

This is an ERC-20 that implements [ERC-7802](https://eips.ethereum.org/EIPS/eip-7802). It exposes two core methods:

```solidity
function crosschainMint(address to, uint256 amount) external;
function crosschainBurn(address from, uint256 amount) external;
```

Both are restricted to calls from the predeployed `SuperchainTokenBridge`. Calls from any other address revert.

```solidity
function crosschainBurn(address from, uint256 amount) external {
    if (msg.sender != Predeploys.SUPERCHAIN_TOKEN_BRIDGE) revert Unauthorized();
    _burn(from, amount);
    emit CrosschainBurn(from, amount, msg.sender);
}
```

The token must also be deployed at the same address on every OP Chain where it will be bridged. This can be done using `CREATE2` or the `OptimismSuperchainERC20Factory`.

## Bridging Workflow

**Source Chain**

	1.	The user calls `sendERC20(token, to, amount, destChainId)` on the `SuperchainTokenBridge`.
	2.	The bridge calls `crosschainBurn()` on the token.
	3.	It sends a message to the destination chain via `L2ToL2CrossDomainMessenger`.

**Destination Chain**

	4.	A relayer submits the message.
	5.	The destination bridge receives it and calls `crosschainMint()` on the token.
	6.	The tokens are minted to the destination user.


## `SuperchainTokenBridge` Contract Walkthrough

### `sendERC20`
```solidity
function sendERC20(address token, address to, uint256 amount, uint256 chainId)
    external
    returns (bytes32 msgHash_)
{
    SuperchainERC20(token).crosschainBurn(msg.sender, amount);
    bytes memory message = abi.encodeCall(this.relayERC20, (token, msg.sender, to, amount));
    msgHash_ = L2ToL2CrossDomainMessenger.sendMessage(chainId, address(this), message);
    emit SentERC20(token, msg.sender, to, amount, chainId);
}
```

This function burns the tokens, crafts a message to relayERC20, and passes it through the cross-chain messenger.

### `relayERC20`
```solidity
function relayERC20(address token, address from, address to, uint256 amount) external {
    require(msg.sender == address(L2ToL2CrossDomainMessenger));
    require(L2ToL2CrossDomainMessenger.crossDomainMessageSender() == address(this));
    SuperchainERC20(token).crosschainMint(to, amount);
    emit RelayedERC20(token, from, to, amount, source);
}
```
This function is called on the destination chain. It verifies the message came from the correct sender and then mints tokens to the destination user.

## Deployment Requirements

To make a token interoperable:
- Deploy `SuperchainERC20` at the same address across all target chains.
- Grant `SuperchainTokenBridge` permission to mint and burn.
- (Optional) Use the `OptimismSuperchainERC20Factory` to deploy and register metadata.

## Invariants

These properties are enforced by the system:
- Conservation: Total supply across the Superchain must be preserved.
- Authorization: Only `SuperchainTokenBridge` can mint or burn.
- Determinism: The token must live at the same address on all chains.
- Unique messaging path: All transfers use `L2ToL2CrossDomainMessenger`.

## Comparison: `SuperchainERC20` vs `xERC20`

| Feature | SuperchainERC20 | xERC20 (ERC-7281) |
| --- | --- | --- |
| Trust model | OP Stack governance + fault proofs | Custom allowlist of bridges |
| Addressing | Same address on all chains | Flexible, but requires a registry |
| Permissions | Fixed bridge (SuperchainTokenBridge) | Configurable per bridge |
| Rate limiting | None in v1 | Native |
| Replay protection | Built-in via L2 messaging | Optional |

`xERC20` offers more flexibility, but introduces a “weakest link” risk when multiple bridges are authorized. `SuperchainERC20` favors simplicity and safety, and they are compatible.

## TL;DR

Superchain token interoperability is simple: mint on destination, burn on source. The system uses native predeploys and permissioned bridges to ensure safety, determinism, and 1-block latency, without introducing fragmentation.
