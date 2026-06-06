"""
intelligence.operations — the brain's capability modules.

Each module exposes pure ``handle``-style functions that take a request
payload (a plain dict decoded from JSON) and return a contract envelope
(see ``intelligence.contracts``). They never touch the network or a
database; TypeScript supplies the data and persists the results.

Operations are wired to their public op names in ``intelligence.registry``.
"""
