"""Repository layer (project.md §10): data access over SQLAlchemy / Supabase.

Backend connects to the Supabase pooler with the service role (bypasses RLS);
RLS protects direct frontend/PostgREST access as defense in depth (§11).
"""
