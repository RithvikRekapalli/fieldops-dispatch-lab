# Algorithm Comparison

## Domain Choice

I chose field service dispatch for industrial maintenance. It is close to real logistics and
supply-chain allocation work: technicians have skills, locations, work windows, and active
commitments, while requests have locations, time windows, durations, and priority.

## Algorithms

### Greedy Dispatch

Greedy sorts requests by priority, appointment start, and request id. For each request, it
chooses the feasible unused technician with the best weighted score.

Strengths:

- Simple and explainable.
- Fast enough for real-time incremental dispatch.
- Very good when requests arrive one at a time or when future demand is unknown.

Weaknesses:

- Local choices can consume scarce, flexible resources.
- It can miss better global tradeoffs across the full dispatch wave.

### Hungarian Batch Optimizer

The Hungarian optimizer builds a request-by-resource cost matrix. Infeasible pairings receive a
large cost. Dummy columns allow requests to remain unassigned with a priority-aware penalty.

Strengths:

- Optimizes all pairings simultaneously.
- Handles scarce skills better because it sees opportunity cost across the batch.
- Produces a lower objective score when local decisions conflict.

Weaknesses:

- Best suited to batch decisions where all requests are known.
- The current implementation handles one assignment per technician in a dispatch wave, not a
  full multi-stop route schedule.

## Sample Result

With the default sample data:

- Greedy assigns five of seven requests and keeps travel low.
- Hungarian also assigns five of seven requests, but covers more weighted priority.
- Hungarian accepts higher travel because it keeps the Aurora multi-skilled technician available
  for the Joliet mechanical failure.

That is the central lesson: minimizing travel alone is not the same as optimizing dispatch
quality. In constrained operations, the globally better plan may intentionally spend more travel
to protect scarce capability and urgent work.

## Extensions

The next production-grade improvements would be:

- Multi-job technician routes with time-dependent travel.
- Skill proficiency levels instead of binary skills.
- SLA breach penalties and customer-specific priorities.
- A rolling-horizon solver that combines real-time greedy decisions with periodic batch
  re-optimization.

The current UI already includes scenario import/export so reviewers can replay what-if cases
without editing source files.
