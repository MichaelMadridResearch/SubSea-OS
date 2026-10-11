Point = tuple[float, float]


class NotAVertexError(ValueError):
    """The point is not an exact route vertex. No distance threshold is applied."""


def vertex_index(point: Point, line: list[Point]) -> int | None:
    for index, vertex in enumerate(line):
        if point == vertex:
            return index
    return None


def require_vertex(point: Point, line: list[Point]) -> int:
    index = vertex_index(point, line)
    if index is None:
        raise NotAVertexError(
            "Alert location is not a vertex of the route. No proximity threshold is applied."
        )
    return index
