from app.mapping import NotAVertexError, require_vertex, vertex_index


def test_exact_vertex_matches() -> None:
    line = [(1.0, 53.5), (1.2, 53.6), (1.5, 53.7)]
    assert vertex_index((1.2, 53.6), line) == 1
    assert require_vertex((1.0, 53.5), line) == 0


def test_off_vertex_is_rejected_without_a_threshold() -> None:
    line = [(1.0, 53.5), (1.2, 53.6)]
    assert vertex_index((1.1, 53.55), line) is None
    try:
        require_vertex((1.1, 53.55), line)
    except NotAVertexError as exc:
        assert "No proximity threshold" in str(exc)
    else:
        raise AssertionError("expected NotAVertexError")
