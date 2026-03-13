# NutriTracker Project Guide

## Rules

Use the smallest possible diff to make a change. Don't add unnecessary helpers unless they deduplicate code. Do not use
fallbacks with ternaries or the ||
operator. No typeof checks either use zod or rely on the type system. No backwards compat whatsoever. I want the
SMALLEST possible set of
changes to make this work, nothing more, nothing less. This is not a giant enterprise project but a personal proof of
concept.