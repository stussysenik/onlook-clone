//! wasm-diff — Field-level diff engine for canvas elements.
//!
//! Mirrors the Go diff engine's algorithm: compare two JSON snapshots of an
//! element and produce a delta of changed fields. This enables instant local
//! diff preview before the API roundtrip completes.
//!
//! ## Tracked Fields
//!
//! x, y, width, height, rotation, z_index, name, locked, visible, styles

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

/// A single field change: what it was, what it is now.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FieldChange {
    pub from: Value,
    pub to: Value,
}

/// A delta for one element.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ElementDelta {
    pub id: String,
    pub changes: HashMap<String, FieldChange>,
}

/// Fields we track for diffs (same as the Go engine).
const TRACKED_FIELDS: &[&str] = &[
    "x", "y", "width", "height", "rotation", "z_index",
    "name", "locked", "visible", "styles",
];

/// Compare two element JSON objects and return a delta.
///
/// Returns `None` if there are no changes.
fn diff_elements(prev: &Value, curr: &Value) -> Option<ElementDelta> {
    let id = curr
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let mut changes = HashMap::new();

    for &field in TRACKED_FIELDS {
        let prev_val = prev.get(field).cloned().unwrap_or(Value::Null);
        let curr_val = curr.get(field).cloned().unwrap_or(Value::Null);

        if prev_val != curr_val {
            changes.insert(
                field.to_string(),
                FieldChange {
                    from: prev_val,
                    to: curr_val,
                },
            );
        }
    }

    if changes.is_empty() {
        None
    } else {
        Some(ElementDelta { id, changes })
    }
}

/// Compute a delta between two element JSON strings.
///
/// Input: two JSON objects representing the same element at different points in time.
/// Output: JSON string of `{ id, changes: { field: { from, to } } }` or `"null"` if no changes.
#[wasm_bindgen]
pub fn compute_delta(prev_json: &str, curr_json: &str) -> String {
    let prev: Value = match serde_json::from_str(prev_json) {
        Ok(v) => v,
        Err(_) => return "null".to_string(),
    };
    let curr: Value = match serde_json::from_str(curr_json) {
        Ok(v) => v,
        Err(_) => return "null".to_string(),
    };

    match diff_elements(&prev, &curr) {
        Some(delta) => serde_json::to_string(&delta).unwrap_or_else(|_| "null".to_string()),
        None => "null".to_string(),
    }
}

/// Batch compute deltas for multiple element pairs.
///
/// Input: JSON array of `[{ prev: {...}, curr: {...} }, ...]`
/// Output: JSON array of deltas (only includes elements that actually changed).
#[wasm_bindgen]
pub fn batch_compute_deltas(pairs_json: &str) -> String {
    #[derive(Deserialize)]
    struct Pair {
        prev: Value,
        curr: Value,
    }

    let pairs: Vec<Pair> = match serde_json::from_str(pairs_json) {
        Ok(v) => v,
        Err(_) => return "[]".to_string(),
    };

    let deltas: Vec<ElementDelta> = pairs
        .iter()
        .filter_map(|p| diff_elements(&p.prev, &p.curr))
        .collect();

    serde_json::to_string(&deltas).unwrap_or_else(|_| "[]".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_changes() {
        let json = r#"{"id":"1","x":10,"y":20,"width":100,"height":50}"#;
        let result = compute_delta(json, json);
        assert_eq!(result, "null");
    }

    #[test]
    fn test_position_change() {
        let prev = r#"{"id":"1","x":10,"y":20,"width":100,"height":50}"#;
        let curr = r#"{"id":"1","x":30,"y":40,"width":100,"height":50}"#;
        let result = compute_delta(prev, curr);
        let delta: ElementDelta = serde_json::from_str(&result).unwrap();
        assert_eq!(delta.id, "1");
        assert!(delta.changes.contains_key("x"));
        assert!(delta.changes.contains_key("y"));
        assert!(!delta.changes.contains_key("width"));
    }

    #[test]
    fn test_batch_deltas() {
        let input = r#"[
            {"prev": {"id":"1","x":0,"y":0}, "curr": {"id":"1","x":10,"y":0}},
            {"prev": {"id":"2","x":5,"y":5}, "curr": {"id":"2","x":5,"y":5}}
        ]"#;
        let result = batch_compute_deltas(input);
        let deltas: Vec<ElementDelta> = serde_json::from_str(&result).unwrap();
        assert_eq!(deltas.len(), 1); // only first element changed
        assert_eq!(deltas[0].id, "1");
    }
}
