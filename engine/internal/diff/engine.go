package diff

// Change represents a single field-level change
type Change struct {
	From interface{} `json:"from"`
	To   interface{} `json:"to"`
}

// Delta represents all changes for an element
type Delta struct {
	ID      string            `json:"id"`
	Changes map[string]Change `json:"changes"`
}

// ComputeDelta compares previous and current element state and returns field-level changes.
// Uses explicit field comparison (no reflection) for clarity and performance.
func ComputeDelta(previous, current map[string]interface{}) *Delta {
	if previous == nil || current == nil {
		return nil
	}

	id, ok := current["id"].(string)
	if !ok {
		return nil
	}

	changes := make(map[string]Change)

	// Compare tracked fields explicitly
	trackedFields := []string{
		"x", "y", "width", "height", "rotation",
		"z_index", "name", "locked", "visible",
	}

	for _, field := range trackedFields {
		prev, hasPrev := previous[field]
		curr, hasCurr := current[field]

		if !hasPrev && !hasCurr {
			continue
		}

		if !hasPrev || !hasCurr || !valuesEqual(prev, curr) {
			changes[field] = Change{From: prev, To: curr}
		}
	}

	// Compare styles (nested object)
	prevStyles, _ := previous["styles"].(map[string]interface{})
	currStyles, _ := current["styles"].(map[string]interface{})
	if prevStyles != nil || currStyles != nil {
		if !stylesEqual(prevStyles, currStyles) {
			changes["styles"] = Change{From: prevStyles, To: currStyles}
		}
	}

	if len(changes) == 0 {
		return nil
	}

	return &Delta{
		ID:      id,
		Changes: changes,
	}
}

func valuesEqual(a, b interface{}) bool {
	// Handle numeric comparison (JSON numbers can be float64)
	af, aOk := toFloat64(a)
	bf, bOk := toFloat64(b)
	if aOk && bOk {
		return af == bf
	}

	return a == b
}

func toFloat64(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	default:
		return 0, false
	}
}

func stylesEqual(a, b map[string]interface{}) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		bv, ok := b[k]
		if !ok || !valuesEqual(v, bv) {
			return false
		}
	}
	return true
}
