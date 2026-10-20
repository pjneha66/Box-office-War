//! Box Office War - 2D Studio Lot Simulation Core & Isometric Engine
//! Architecture: Hermes Core for poshstudio
//! Zero Emojis Policy strictly enforced.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashMap, HashSet};
use std::cmp::Ordering;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum TileType {
    Grass = 0,
    Road = 1,
    Plaza = 2,
    ConcretePad = 3,
    WaterFountain = 4,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum BuildingType {
    Soundstage = 0,
    LedVolume = 1,
    PostSuite = 2,
    WritersBungalow = 3,
    CinemaTheater = 4,
    StudioGate = 5,
    PropWorkshop = 6,
    ExecutiveBldg = 7,
}

impl BuildingType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "soundstage" => Some(BuildingType::Soundstage),
            "led_volume" | "virtual_led" => Some(BuildingType::LedVolume),
            "post_suite" => Some(BuildingType::PostSuite),
            "writers_bungalow" => Some(BuildingType::WritersBungalow),
            "cinema_theater" | "cinema" => Some(BuildingType::CinemaTheater),
            "studio_gate" | "gate" => Some(BuildingType::StudioGate),
            "prop_workshop" | "backlot" => Some(BuildingType::PropWorkshop),
            "executive" => Some(BuildingType::ExecutiveBldg),
            _ => None,
        }
    }

    pub fn to_str(&self) -> &'static str {
        match self {
            BuildingType::Soundstage => "soundstage",
            BuildingType::LedVolume => "virtual_led",
            BuildingType::PostSuite => "post_suite",
            BuildingType::WritersBungalow => "writers_bungalow",
            BuildingType::CinemaTheater => "cinema_theater",
            BuildingType::StudioGate => "studio_gate",
            BuildingType::PropWorkshop => "backlot",
            BuildingType::ExecutiveBldg => "executive",
        }
    }

    pub fn tile_span(&self) -> (i32, i32) {
        match self {
            BuildingType::Soundstage => (3, 3),
            BuildingType::LedVolume => (3, 3),
            BuildingType::CinemaTheater => (3, 3),
            BuildingType::PropWorkshop => (3, 2),
            BuildingType::PostSuite => (2, 2),
            BuildingType::ExecutiveBldg => (2, 2),
            BuildingType::WritersBungalow => (2, 2),
            BuildingType::StudioGate => (2, 1),
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            BuildingType::Soundstage => "Soundstage Complex",
            BuildingType::LedVolume => "Virtual LED Volume",
            BuildingType::PostSuite => "Dolby Atmos Post Suite",
            BuildingType::WritersBungalow => "Writers Guild Bungalow",
            BuildingType::CinemaTheater => "Premiere Cinema Marquee",
            BuildingType::StudioGate => "Historic Studio Gate",
            BuildingType::PropWorkshop => "Modular Backlot & Props",
            BuildingType::ExecutiveBldg => "Executive Suite",
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Building {
    pub id: u32,
    pub b_type: BuildingType,
    pub type_str: String,
    pub name: String,
    pub tier: u8,
    pub grid_x: i32,
    pub grid_y: i32,
    pub span_w: i32,
    pub span_h: i32,
    pub active_project_id: Option<String>,
    pub active_title: String,
    pub active_phase: String,
    pub progress: f32,
    pub filming_active: bool,
    pub crew_count: u32,
    pub efficiency_boost: f32,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum AgentKind {
    Director = 0,
    StarActor = 1,
    ExtraActor = 2,
    CameraOperator = 3,
    Producer = 4,
    Audience = 5,
    Paparazzi = 6,
}

impl AgentKind {
    pub fn from_str(s: &str) -> Self {
        match s {
            "director" => AgentKind::Director,
            "star_actor" | "actor" => AgentKind::StarActor,
            "extra" => AgentKind::ExtraActor,
            "cameraman" | "camera" => AgentKind::CameraOperator,
            "producer" => AgentKind::Producer,
            "audience" => AgentKind::Audience,
            "paparazzi" => AgentKind::Paparazzi,
            _ => AgentKind::ExtraActor,
        }
    }

    pub fn to_str(&self) -> &'static str {
        match self {
            AgentKind::Director => "director",
            AgentKind::StarActor => "star_actor",
            AgentKind::ExtraActor => "extra",
            AgentKind::CameraOperator => "cameraman",
            AgentKind::Producer => "producer",
            AgentKind::Audience => "audience",
            AgentKind::Paparazzi => "paparazzi",
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum AgentState {
    Idle = 0,
    Walking = 1,
    Filming = 2,
    Reviewing = 3,
    Queuing = 4,
    Cheering = 5,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LotAgent {
    pub id: u32,
    pub kind: AgentKind,
    pub kind_str: String,
    pub name: String,
    pub x: f32,
    pub y: f32,
    pub target_x: i32,
    pub target_y: i32,
    pub state: AgentState,
    pub state_str: String,
    pub path: Vec<(i32, i32)>,
    pub speed: f32,
    pub anim_timer: f32,
    pub assigned_building_id: Option<u32>,
    pub costume_id: u8,
}

// A* Node representation
#[derive(Copy, Clone, Eq, PartialEq)]
struct PathNode {
    pos: (i32, i32),
    cost: i32,
    heuristic: i32,
}

impl Ord for PathNode {
    fn cmp(&self, other: &Self) -> Ordering {
        (other.cost + other.heuristic).cmp(&(self.cost + self.heuristic))
    }
}

impl PartialOrd for PathNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

#[wasm_bindgen]
pub struct StudioLotEngine {
    cols: i32,
    rows: i32,
    tiles: Vec<TileType>,
    buildings: Vec<Building>,
    agents: Vec<LotAgent>,
    next_id: u32,
    current_week: u32,
    total_tickets_sold: u64,
    box_office_buzz: f32,
}

#[wasm_bindgen]
impl StudioLotEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(cols: i32, rows: i32) -> StudioLotEngine {
        let cols = if cols <= 0 { 24 } else { cols };
        let rows = if rows <= 0 { 24 } else { rows };
        let count = (cols * rows) as usize;
        let mut tiles = vec![TileType::Grass; count];

        // Lay default paved roads and central studio plaza
        for r in 0..rows {
            for c in 0..cols {
                let idx = (r * cols + c) as usize;
                // Main central avenue (vertical)
                if c == cols / 2 || c == (cols / 2) - 1 {
                    tiles[idx] = TileType::Road;
                }
                // Main horizontal crosstown boulevard
                else if r == rows / 2 || r == (rows / 2) - 1 {
                    tiles[idx] = TileType::Road;
                }
                // Studio perimeter access roads
                else if r == 2 || r == rows - 3 || c == 2 || c == cols - 3 {
                    tiles[idx] = TileType::Road;
                }
                // Central studio fountain plaza
                else if (c >= (cols / 2) - 3 && c <= (cols / 2) + 2) && (r >= (rows / 2) - 3 && r <= (rows / 2) + 2) {
                    if (c == (cols / 2) || c == (cols / 2) - 1) && (r == (rows / 2) || r == (rows / 2) - 1) {
                        tiles[idx] = TileType::WaterFountain;
                    } else {
                        tiles[idx] = TileType::Plaza;
                    }
                }
            }
        }

        let mut engine = StudioLotEngine {
            cols,
            rows,
            tiles,
            buildings: Vec::new(),
            agents: Vec::new(),
            next_id: 1,
            current_week: 1,
            total_tickets_sold: 0,
            box_office_buzz: 1.0,
        };

        // Populate initial historic studio layout
        engine.init_starter_studio();
        engine
    }

    fn init_starter_studio(&mut self) {
        // Place Studio Gate at entrance
        let _ = self.place_building_internal(BuildingType::StudioGate, self.cols / 2 - 1, self.rows - 2);

        // Place Executive Suite near entrance plaza
        let _ = self.place_building_internal(BuildingType::ExecutiveBldg, self.cols / 2 + 2, self.rows - 5);

        // Place Soundstage A
        let _ = self.place_building_internal(BuildingType::Soundstage, 4, 4);

        // Place Post-Production Suite
        let _ = self.place_building_internal(BuildingType::PostSuite, 4, 10);

        // Place Premiere Cinema Marquee on the public boulevard
        let _ = self.place_building_internal(BuildingType::CinemaTheater, self.cols - 6, 4);

        // Place Writers Bungalow in a quiet corner
        let _ = self.place_building_internal(BuildingType::WritersBungalow, self.cols - 5, 12);

        // Spawn starter staff
        self.spawn_agent_internal(AgentKind::Director, "Stanley Kubrick", 7.0, 7.0, Some(3));
        self.spawn_agent_internal(AgentKind::CameraOperator, "Chief Cinematographer", 6.0, 7.0, Some(3));
        self.spawn_agent_internal(AgentKind::StarActor, "Leading Star", 8.0, 7.0, Some(3));
        self.spawn_agent_internal(AgentKind::Producer, "Executive Producer", (self.cols / 2) as f32, (self.rows - 4) as f32, Some(2));
    }

    fn place_building_internal(&mut self, b_type: BuildingType, x: i32, y: i32) -> Result<u32, String> {
        let (span_w, span_h) = b_type.tile_span();

        if x < 0 || y < 0 || x + span_w > self.cols || y + span_h > self.rows {
            return Err("Building placement exceeds grid boundaries.".into());
        }

        // Check collision with existing buildings
        for b in &self.buildings {
            if !(x + span_w <= b.grid_x || x >= b.grid_x + b.span_w || y + span_h <= b.grid_y || y >= b.grid_y + b.span_h) {
                return Err(format!("Collision with existing building: {}", b.name));
            }
        }

        // Mark concrete foundation under building footprint
        for r in y..(y + span_h) {
            for c in x..(x + span_w) {
                let idx = (r * self.cols + c) as usize;
                if idx < self.tiles.len() {
                    self.tiles[idx] = TileType::ConcretePad;
                }
            }
        }

        let id = self.next_id;
        self.next_id += 1;

        let name = format!("{} #{}", b_type.display_name(), id);
        let building = Building {
            id,
            b_type,
            type_str: b_type.to_str().to_string(),
            name,
            tier: 1,
            grid_x: x,
            grid_y: y,
            span_w,
            span_h,
            active_project_id: None,
            active_title: String::new(),
            active_phase: String::new(),
            progress: 0.0,
            filming_active: false,
            crew_count: 0,
            efficiency_boost: 1.0,
        };

        self.buildings.push(building);
        Ok(id)
    }

    #[wasm_bindgen]
    pub fn place_building(&mut self, b_type_str: &str, x: i32, y: i32) -> Result<u32, JsValue> {
        let b_type = BuildingType::from_str(b_type_str)
            .ok_or_else(|| JsValue::from_str(&format!("Invalid building type: {}", b_type_str)))?;
        self.place_building_internal(b_type, x, y)
            .map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen]
    pub fn upgrade_building(&mut self, building_id: u32) -> Result<u8, JsValue> {
        if let Some(b) = self.buildings.iter_mut().find(|b| b.id == building_id) {
            if b.tier >= 5 {
                return Err(JsValue::from_str("Building already at maximum tier 5."));
            }
            b.tier += 1;
            b.efficiency_boost += 0.15;
            Ok(b.tier)
        } else {
            Err(JsValue::from_str("Building not found."))
        }
    }

    #[wasm_bindgen]
    pub fn demolish_building(&mut self, building_id: u32) -> Result<bool, JsValue> {
        let idx = self.buildings.iter().position(|b| b.id == building_id)
            .ok_or_else(|| JsValue::from_str("Building not found."))?;

        let b = self.buildings.remove(idx);
        // Restore grass on building footprint
        for r in b.grid_y..(b.grid_y + b.span_h) {
            for c in b.grid_x..(b.grid_x + b.span_w) {
                let t_idx = (r * self.cols + c) as usize;
                if t_idx < self.tiles.len() {
                    self.tiles[t_idx] = TileType::Grass;
                }
            }
        }
        Ok(true)
    }

    #[wasm_bindgen]
    pub fn assign_production(&mut self, building_id: u32, project_id: &str, title: &str, phase: &str, progress: f32) -> bool {
        if let Some(b) = self.buildings.iter_mut().find(|b| b.id == building_id) {
            b.active_project_id = if project_id.is_empty() { None } else { Some(project_id.to_string()) };
            b.active_title = title.to_string();
            b.active_phase = phase.to_string();
            b.progress = progress.clamp(0.0, 1.0);
            b.filming_active = phase == "shoot" || phase == "post";
            true
        } else {
            false
        }
    }

    fn spawn_agent_internal(&mut self, kind: AgentKind, name: &str, x: f32, y: f32, building_id: Option<u32>) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        let speed = match kind {
            AgentKind::StarActor => 2.2,
            AgentKind::Director => 2.5,
            AgentKind::CameraOperator => 2.0,
            AgentKind::Producer => 2.4,
            AgentKind::Audience => 1.8,
            AgentKind::Paparazzi => 3.2,
            AgentKind::ExtraActor => 2.0,
        };

        let agent = LotAgent {
            id,
            kind,
            kind_str: kind.to_str().to_string(),
            name: name.to_string(),
            x,
            y,
            target_x: x as i32,
            target_y: y as i32,
            state: AgentState::Idle,
            state_str: "idle".to_string(),
            path: Vec::new(),
            speed,
            anim_timer: 0.0,
            assigned_building_id: building_id,
            costume_id: (id % 5) as u8,
        };
        self.agents.push(agent);
        id
    }

    #[wasm_bindgen]
    pub fn spawn_agent(&mut self, kind_str: &str, name: &str, x: f32, y: f32, building_id: i32) -> u32 {
        let kind = AgentKind::from_str(kind_str);
        let b_id = if building_id <= 0 { None } else { Some(building_id as u32) };
        self.spawn_agent_internal(kind, name, x, y, b_id)
    }

    #[wasm_bindgen]
    pub fn send_agent_to(&mut self, agent_id: u32, target_x: i32, target_y: i32) -> bool {
        let path = self.find_path_internal(target_x, target_y, agent_id);
        if let Some(agent) = self.agents.iter_mut().find(|a| a.id == agent_id) {
            agent.target_x = target_x;
            agent.target_y = target_y;
            agent.path = path;
            if !agent.path.is_empty() {
                agent.state = AgentState::Walking;
                agent.state_str = "walking".to_string();
            }
            true
        } else {
            false
        }
    }

    fn find_path_internal(&self, target_x: i32, target_y: i32, agent_id: u32) -> Vec<(i32, i32)> {
        let agent = match self.agents.iter().find(|a| a.id == agent_id) {
            Some(a) => a,
            None => return Vec::new(),
        };

        let start_x = agent.x.round() as i32;
        let start_y = agent.y.round() as i32;

        if start_x == target_x && start_y == target_y {
            return Vec::new();
        }

        // Build walkable map
        let mut blocked = HashSet::new();
        for b in &self.buildings {
            // Allow entry to door of target building
            let is_target = target_x >= b.grid_x && target_x < b.grid_x + b.span_w
                && target_y >= b.grid_y && target_y < b.grid_y + b.span_h;
            if !is_target {
                for r in b.grid_y..(b.grid_y + b.span_h) {
                    for c in b.grid_x..(b.grid_x + b.span_w) {
                        blocked.insert((c, r));
                    }
                }
            }
        }

        let mut open_set = BinaryHeap::new();
        let mut came_from: HashMap<(i32, i32), (i32, i32)> = HashMap::new();
        let mut g_score: HashMap<(i32, i32), i32> = HashMap::new();

        let h = (target_x - start_x).abs() + (target_y - start_y).abs();
        open_set.push(PathNode { pos: (start_x, start_y), cost: 0, heuristic: h });
        g_score.insert((start_x, start_y), 0);

        let directions = [(1, 0), (-1, 0), (0, 1), (0, -1)];

        while let Some(current) = open_set.pop() {
            if current.pos == (target_x, target_y) {
                // Reconstruct path
                let mut path = Vec::new();
                let mut curr = current.pos;
                while let Some(&prev) = came_from.get(&curr) {
                    path.push(curr);
                    curr = prev;
                }
                path.reverse();
                return path;
            }

            let current_g = *g_score.get(&current.pos).unwrap_or(&i32::MAX);

            for (dx, dy) in directions.iter() {
                let neighbor = (current.pos.0 + dx, current.pos.1 + dy);
                if neighbor.0 < 0 || neighbor.0 >= self.cols || neighbor.1 < 0 || neighbor.1 >= self.rows {
                    continue;
                }
                if blocked.contains(&neighbor) && neighbor != (target_x, target_y) {
                    continue;
                }

                // Roads and plazas have lower movement penalty
                let tile_idx = (neighbor.1 * self.cols + neighbor.0) as usize;
                let move_cost = if tile_idx < self.tiles.len() {
                    match self.tiles[tile_idx] {
                        TileType::Road => 8,
                        TileType::Plaza => 10,
                        TileType::ConcretePad => 12,
                        TileType::Grass => 16,
                        TileType::WaterFountain => 999, // Unwalkable water
                    }
                } else {
                    15
                };

                if move_cost >= 900 {
                    continue;
                }

                let tentative_g = current_g + move_cost;
                if tentative_g < *g_score.get(&neighbor).unwrap_or(&i32::MAX) {
                    came_from.insert(neighbor, current.pos);
                    g_score.insert(neighbor, tentative_g);
                    let heuristic = (target_x - neighbor.0).abs() + (target_y - neighbor.1).abs();
                    open_set.push(PathNode {
                        pos: neighbor,
                        cost: tentative_g,
                        heuristic,
                    });
                }
            }
        }

        Vec::new()
    }

    #[wasm_bindgen]
    pub fn tick(&mut self, dt: f32, current_week: u32) {
        self.current_week = current_week;
        let dt_clamped = dt.clamp(0.001, 0.1);

        // Update agents
        for i in 0..self.agents.len() {
            let mut agent = self.agents[i].clone();
            agent.anim_timer += dt_clamped;

            if !agent.path.is_empty() {
                let next_node = agent.path[0];
                let target_pos_x = next_node.0 as f32 + 0.5;
                let target_pos_y = next_node.1 as f32 + 0.5;

                let dx = target_pos_x - agent.x;
                let dy = target_pos_y - agent.y;
                let dist = (dx * dx + dy * dy).sqrt();

                let step = agent.speed * dt_clamped;
                if dist <= step || dist < 0.05 {
                    agent.x = target_pos_x;
                    agent.y = target_pos_y;
                    agent.path.remove(0);

                    if agent.path.is_empty() {
                        // Reached destination, update state
                        match agent.kind {
                            AgentKind::Director | AgentKind::CameraOperator | AgentKind::StarActor => {
                                agent.state = AgentState::Filming;
                                agent.state_str = "filming".to_string();
                            }
                            AgentKind::Audience => {
                                agent.state = AgentState::Queuing;
                                agent.state_str = "queuing".to_string();
                            }
                            _ => {
                                agent.state = AgentState::Idle;
                                agent.state_str = "idle".to_string();
                            }
                        }
                    }
                } else {
                    agent.x += (dx / dist) * step;
                    agent.y += (dy / dist) * step;
                    agent.state = AgentState::Walking;
                    agent.state_str = "walking".to_string();
                }
            }

            self.agents[i] = agent;
        }

        // Clean up distant audience members after watching movie
        if self.agents.len() > 25 {
            self.agents.retain(|a| !(a.kind == AgentKind::Audience && a.state == AgentState::Queuing && a.anim_timer > 30.0));
        }
    }

    #[wasm_bindgen]
    pub fn trigger_box_office_surge(&mut self, film_title: &str, weekend_gross_m: f64) {
        self.box_office_buzz = (weekend_gross_m as f32 * 0.1).clamp(1.0, 10.0);
        let tickets = (weekend_gross_m * 100_000.0) as u64;
        self.total_tickets_sold += tickets;

        // Find cinema building
        let cinema_pos = self.buildings.iter()
            .find(|b| b.b_type == BuildingType::CinemaTheater)
            .map(|b| (b.grid_x + 1, b.grid_y + b.span_h));

        if let Some((cx, cy)) = cinema_pos {
            // Spawn 3 to 6 audience agents heading to the cinema marquee
            let count = ((weekend_gross_m / 10.0).round() as usize).clamp(2, 6);
            for i in 0..count {
                let spawn_x = ((self.cols / 2) as f32) + ((i as f32) * 0.8) - 1.5;
                let spawn_y = (self.rows - 2) as f32;
                let id = self.spawn_agent_internal(
                    AgentKind::Audience,
                    &format!("Moviegoer {}", self.next_id),
                    spawn_x,
                    spawn_y,
                    None,
                );
                let _ = self.send_agent_to(id, cx + (i as i32 % 2), cy + (i as i32 / 2));
            }
        }
    }

    #[wasm_bindgen]
    pub fn sync_studio_facilities(&mut self, facilities_json: &str) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(facilities_json) {
            if let Some(obj) = val.as_object() {
                for (key, fac_val) in obj {
                    if let Some(tier) = fac_val.get("tier").and_then(|t| t.as_u64()) {
                        let tier = tier as u8;
                        let b_type = BuildingType::from_str(key);
                        if let Some(bt) = b_type {
                            if let Some(b) = self.buildings.iter_mut().find(|b| b.b_type == bt) {
                                b.tier = tier.clamp(1, 5);
                                b.efficiency_boost = 1.0 + (tier as f32 * 0.15);
                            }
                        }
                    }
                }
            }
        }
    }

    #[wasm_bindgen]
    pub fn get_lot_state_json(&self) -> String {
        let snapshot = serde_json::json!({
            "cols": self.cols,
            "rows": self.rows,
            "current_week": self.current_week,
            "total_tickets_sold": self.total_tickets_sold,
            "box_office_buzz": self.box_office_buzz,
            "buildings": self.buildings,
            "agents": self.agents,
        });
        snapshot.to_string()
    }

    #[wasm_bindgen]
    pub fn get_tiles_flat(&self) -> Vec<u8> {
        self.tiles.iter().map(|&t| t as u8).collect()
    }

    #[wasm_bindgen]
    pub fn calculate_lot_quality_multiplier(&self) -> f32 {
        let mut total_mult = 1.0f32;
        for b in &self.buildings {
            match b.b_type {
                BuildingType::Soundstage => total_mult += (b.tier as f32) * 0.03,
                BuildingType::LedVolume => total_mult += (b.tier as f32) * 0.05,
                BuildingType::PostSuite => total_mult += (b.tier as f32) * 0.04,
                BuildingType::PropWorkshop => total_mult += (b.tier as f32) * 0.03,
                BuildingType::WritersBungalow => total_mult += (b.tier as f32) * 0.02,
                _ => {}
            }
        }
        total_mult
    }
}
