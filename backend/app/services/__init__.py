"""Thin orchestration services (project.md §10).

Services coordinate domain packages (engines/, optimizer/, simulator/, …) with
repositories. Domain logic lives in the domain packages — keep services thin.
Wired to the real pipeline in issue #16."""
