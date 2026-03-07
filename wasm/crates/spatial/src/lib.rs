//! wasm-spatial — R-tree spatial index for O(log n) hit testing.
//!
//! Uses the `rstar` crate (R*-tree) for spatial queries. Each canvas element
//! is stored as an axis-aligned bounding box (AABB) with metadata (z_index,
//! visible, locked flags).
//!
//! ## Why an R-tree?
//!
//! Linear scan over N elements is O(n) per pointer event. With 1000+ elements,
//! this causes dropped frames. An R-tree gives O(log n) point queries and
//! O(log n + k) range queries (k = results).

use rstar::{primitives::Rectangle, RTree, RTreeObject, AABB};
use serde::Deserialize;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

/// Metadata stored alongside each AABB in the R-tree.
#[derive(Clone, Debug)]
struct ElementEntry {
    id: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    z_index: i32,
    visible: bool,
    locked: bool,
}

/// JSON input format for bulk_load.
#[derive(Deserialize)]
struct ElementInput {
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    z_index: i32,
    visible: bool,
    locked: bool,
}

/// The spatial index. Maintains an R-tree plus a HashMap for O(1) lookups by ID.
///
/// The R-tree is rebuilt on structural changes (insert/remove). Updates that only
/// change position rebuild in bulk — this is fast because `rstar` bulk loading
/// is O(n log n) and we're dealing with <10K elements typically.
#[wasm_bindgen]
pub struct SpatialIndex {
    entries: HashMap<String, ElementEntry>,
    tree: RTree<Rectangle<[f64; 2]>>,
    /// Parallel vec of IDs matching tree insertion order (for mapping hits back to IDs).
    /// Rebuilt whenever the tree is rebuilt.
    tree_ids: Vec<String>,
}

#[wasm_bindgen]
impl SpatialIndex {
    /// Create an empty spatial index.
    #[wasm_bindgen(constructor)]
    pub fn new() -> SpatialIndex {
        SpatialIndex {
            entries: HashMap::new(),
            tree: RTree::new(),
            tree_ids: Vec::new(),
        }
    }

    /// Bulk load elements from a JSON array.
    ///
    /// Expected format: `[{ id, x, y, width, height, z_index, visible, locked }, ...]`
    #[wasm_bindgen]
    pub fn bulk_load(&mut self, json: &str) {
        let items: Vec<ElementInput> = match serde_json::from_str(json) {
            Ok(v) => v,
            Err(_) => return,
        };

        self.entries.clear();
        for item in &items {
            self.entries.insert(
                item.id.clone(),
                ElementEntry {
                    id: item.id.clone(),
                    x: item.x,
                    y: item.y,
                    w: item.width,
                    h: item.height,
                    z_index: item.z_index,
                    visible: item.visible,
                    locked: item.locked,
                },
            );
        }
        self.rebuild_tree();
    }

    /// Insert or update a single element.
    #[wasm_bindgen]
    pub fn upsert(
        &mut self,
        id: &str,
        x: f64,
        y: f64,
        w: f64,
        h: f64,
        z_index: i32,
        visible: bool,
        locked: bool,
    ) {
        self.entries.insert(
            id.to_string(),
            ElementEntry {
                id: id.to_string(),
                x,
                y,
                w,
                h,
                z_index,
                visible,
                locked,
            },
        );
        self.rebuild_tree();
    }

    /// Remove an element by ID.
    #[wasm_bindgen]
    pub fn remove(&mut self, id: &str) {
        self.entries.remove(id);
        self.rebuild_tree();
    }

    /// Hit test: find the top-most visible, unlocked element at (x, y) in canvas-space.
    ///
    /// Returns the element ID, or empty string if nothing hit.
    /// "Top-most" = highest z_index among candidates.
    #[wasm_bindgen]
    pub fn hit_test(&self, x: f64, y: f64) -> String {
        let point = [x, y];
        let mut best_id = String::new();
        let mut best_z = i32::MIN;

        // Query all rectangles containing the point
        for rect in self.tree.locate_all_at_point(&point) {
            let aabb = rect.envelope();
            let lower = aabb.lower();
            let upper = aabb.upper();

            // Find matching entry by bounds
            for entry in self.entries.values() {
                if !entry.visible || entry.locked {
                    continue;
                }
                if (entry.x - lower[0]).abs() < 0.01
                    && (entry.y - lower[1]).abs() < 0.01
                    && (entry.x + entry.w - upper[0]).abs() < 0.01
                    && (entry.y + entry.h - upper[1]).abs() < 0.01
                {
                    if entry.z_index > best_z {
                        best_z = entry.z_index;
                        best_id = entry.id.clone();
                    }
                }
            }
        }

        best_id
    }

    /// Query all elements intersecting a rectangle (marquee selection).
    ///
    /// Returns a JSON array of IDs: `["id1", "id2", ...]`
    /// Only includes visible, unlocked elements.
    #[wasm_bindgen]
    pub fn query_rect(&self, x: f64, y: f64, w: f64, h: f64) -> String {
        let query_aabb = AABB::from_corners([x, y], [x + w, y + h]);
        let mut ids: Vec<String> = Vec::new();

        for rect in self.tree.locate_in_envelope_intersecting(&query_aabb) {
            let aabb = rect.envelope();
            let lower = aabb.lower();
            let upper = aabb.upper();

            for entry in self.entries.values() {
                if !entry.visible || entry.locked {
                    continue;
                }
                if (entry.x - lower[0]).abs() < 0.01
                    && (entry.y - lower[1]).abs() < 0.01
                    && (entry.x + entry.w - upper[0]).abs() < 0.01
                    && (entry.y + entry.h - upper[1]).abs() < 0.01
                {
                    ids.push(entry.id.clone());
                }
            }
        }

        serde_json::to_string(&ids).unwrap_or_else(|_| "[]".to_string())
    }

    /// Find the nearest element to a point.
    ///
    /// Returns the element ID, or empty string if the index is empty.
    #[wasm_bindgen]
    pub fn nearest(&self, x: f64, y: f64) -> String {
        let point = [x, y];
        if let Some(rect) = self.tree.nearest_neighbor(&point) {
            let aabb = rect.envelope();
            let lower = aabb.lower();
            let upper = aabb.upper();

            for entry in self.entries.values() {
                if (entry.x - lower[0]).abs() < 0.01
                    && (entry.y - lower[1]).abs() < 0.01
                    && (entry.x + entry.w - upper[0]).abs() < 0.01
                    && (entry.y + entry.h - upper[1]).abs() < 0.01
                {
                    return entry.id.clone();
                }
            }
        }
        String::new()
    }

    /// Number of elements in the index.
    #[wasm_bindgen]
    pub fn size(&self) -> usize {
        self.entries.len()
    }
}

impl SpatialIndex {
    /// Rebuild the R-tree from the entries HashMap.
    fn rebuild_tree(&mut self) {
        let rects: Vec<Rectangle<[f64; 2]>> = self
            .entries
            .values()
            .map(|e| {
                Rectangle::from_corners([e.x, e.y], [e.x + e.w, e.y + e.h])
            })
            .collect();

        self.tree_ids = self.entries.keys().cloned().collect();
        self.tree = RTree::bulk_load(rects);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hit_test_basic() {
        let mut idx = SpatialIndex::new();
        idx.upsert("a", 0.0, 0.0, 100.0, 100.0, 1, true, false);
        idx.upsert("b", 50.0, 50.0, 100.0, 100.0, 2, true, false);

        // Point inside both — should return "b" (higher z)
        let hit = idx.hit_test(75.0, 75.0);
        assert_eq!(hit, "b");

        // Point only inside "a"
        let hit = idx.hit_test(10.0, 10.0);
        assert_eq!(hit, "a");

        // Point outside both
        let hit = idx.hit_test(200.0, 200.0);
        assert_eq!(hit, "");
    }

    #[test]
    fn test_hit_test_locked_invisible() {
        let mut idx = SpatialIndex::new();
        idx.upsert("visible", 0.0, 0.0, 100.0, 100.0, 1, true, false);
        idx.upsert("locked", 0.0, 0.0, 100.0, 100.0, 2, true, true);
        idx.upsert("hidden", 0.0, 0.0, 100.0, 100.0, 3, false, false);

        let hit = idx.hit_test(50.0, 50.0);
        assert_eq!(hit, "visible");
    }

    #[test]
    fn test_query_rect() {
        let mut idx = SpatialIndex::new();
        idx.upsert("a", 0.0, 0.0, 50.0, 50.0, 1, true, false);
        idx.upsert("b", 100.0, 100.0, 50.0, 50.0, 2, true, false);

        let result = idx.query_rect(0.0, 0.0, 60.0, 60.0);
        let ids: Vec<String> = serde_json::from_str(&result).unwrap();
        assert!(ids.contains(&"a".to_string()));
        assert!(!ids.contains(&"b".to_string()));
    }

    #[test]
    fn test_remove() {
        let mut idx = SpatialIndex::new();
        idx.upsert("a", 0.0, 0.0, 100.0, 100.0, 1, true, false);
        assert_eq!(idx.size(), 1);
        idx.remove("a");
        assert_eq!(idx.size(), 0);
        assert_eq!(idx.hit_test(50.0, 50.0), "");
    }
}
