# Azure Preparation Plan

## Status

Prepared and locally validated

## Goal

Convert the repository into a reusable Azure Functions skeleton that deploys cleanly and returns `Hello World` from the root URL.

## Approved Execution Scope

1. Reset the repository to a clean git state
2. Remove invoice-specific code, docs, and sample assets
3. Add a minimal HTTP-triggered Azure Function
4. Simplify Bicep infrastructure and parameter files
5. Update bootstrap and GitHub Actions workflows to match the new skeleton
6. Validate the template locally

## Current Progress

- Git reset completed
- Template simplification underway
- Local TypeScript validation completed
- Local response test completed
- Bicep syntax build completed
