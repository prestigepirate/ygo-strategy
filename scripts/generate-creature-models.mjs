#!/usr/bin/env node
// ── Meshy Text-to-3D batch model generator ──────────────────
// Generates .glb 3D models for all creatures defined in src/data/meshyPrompts.js
//
// Usage:    node scripts/generate-creature-models.mjs
// Env:      MESHY_API_KEY  (or edit API_KEY below)
//
// Workflow for each creature:
//   1. POST /openapi/v2/text-to-3d  →  create preview task (mesh generation)
//   2. Poll until SUCCEEDED
//   3. POST /openapi/v2/text-to-3d  →  create refine task  (texture generation)
//   4. Poll until SUCCEEDED
//   5. Download .glb → public/models/{creatureId}.glb
//
// Cost: ~20 credits per creature (10 preview + 10 refine) on Meshy-6.
// Pro tier gives 500 credits/mo. Generate all 13 creatures ≈ 260 credits.

const API_KEY = process.env.MESHY_API_KEY || "msy_LMcBBl7F4kDQJUI3aahb3yZ32kjZvxKV6x4f";
const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";

const CREATURES = [
  {
    id: "dark-magician",
    name: "Dark Magician",
    prompt: "Dark Magician spellcaster in ornate purple and black robes, holding a glowing jeweled staff, confident battle stance, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "blue-eyes",
    name: "Blue-Eyes White Dragon",
    prompt: "Majestic white dragon with luminous blue eyes, angular crystalline scales, wide spread wings, roaring, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "red-eyes",
    name: "Red-Eyes Black Dragon",
    prompt: "Menacing black dragon with burning red eyes, jagged obsidian scales, leathery wings, aggressive attack stance, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "summoned-skull",
    name: "Summoned Skull",
    prompt: "Horned skeletal demon wreathed in purple lightning, bone-white skull with curved horns, muscular torso, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "kuriboh",
    name: "Kuriboh",
    prompt: "Small fluffy round furball creature with big innocent eyes, tiny claws and feet, cute brown fuzzy monster, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "celtic-guardian",
    name: "Celtic Guardian",
    prompt: "Elven warrior in green and brown leather armor, wielding a curved elven blade, forest guardian watchful stance, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "giant-soldier",
    name: "Giant Soldier of Stone",
    prompt: "Massive stone golem warrior chiseled from ancient granite, heavy fists, monolithic sturdy stance, ancient runes carved into stone body, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "flame-swordsman",
    name: "Flame Swordsman",
    prompt: "Armored knight wielding a massive flaming greatsword, orange and red plate armor, fire aura surrounding the blade, heroic battle pose, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "harpie-lady",
    name: "Harpie Lady",
    prompt: "Winged harpy warrior with large feathered wings spread, taloned feet, windswept hair, aerial attack diving stance, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "luster-dragon",
    name: "Luster Dragon",
    prompt: "Crystalline dragon with sapphire and emerald jewel facets, light refracting through translucent crystal body, elegant serpentine dragon form, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "aqua-madoor",
    name: "Aqua Madoor",
    prompt: "Aquatic wizard controlling water magic, blue and turquoise flowing robes like ocean waves, water orb floating between hands, defensive magic casting stance, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "beaver-warrior",
    name: "Beaver Warrior",
    prompt: "Anthropomorphic beaver warrior in leather armor, wielding a wooden sword and round shield, determined battle-ready stance, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
  {
    id: "zombie-dragon",
    name: "Zombie Dragon",
    prompt: "Undead dragon with rotting torn wings, exposed ribcage bones, green glowing eyes, decayed flesh clinging to skeleton, swamp horror, Yu-Gi-Oh dark fantasy style, stylized 3D game miniature, cel-shaded, game-ready",
  },
];

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

async function createPreview(creature) {
  console.log(`  [${creature.name}] Creating preview task...`);
  const data = await api("POST", "", {
    mode: "preview",
    prompt: creature.prompt,
    ai_model: "meshy-6",
    model_type: "lowpoly",
    target_polycount: 8000,
    topology: "triangle",
    target_formats: ["glb"],
    symmetry_mode: "auto",
  });
  return data.result;
}

async function createRefine(previewTaskId) {
  console.log(`    Creating refine (texture) task...`);
  const data = await api("POST", "", {
    mode: "refine",
    preview_task_id: previewTaskId,
    enable_pbr: true,
    hd_texture: false,
    remove_lighting: true,
  });
  return data.result;
}

async function pollTask(taskId, label) {
  let attempts = 0;
  while (true) {
    const task = await api("GET", `/${taskId}`);
    if (task.status === "SUCCEEDED") return task;
    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(`${label} ${task.status}: ${task.task_error?.message || "unknown"}`);
    }
    attempts++;
    const wait = Math.min(5000 + attempts * 2000, 30000);
    console.log(`    ${label} progress: ${task.progress}% (waiting ${wait / 1000}s)...`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  await import("fs").then((fs) => fs.writeFileSync(destPath, Buffer.from(buf)));
  console.log(`    Saved to ${destPath}`);
}

async function generateCreature(creature) {
  console.log(`\n── ${creature.name} ──`);

  // Step 1: Preview (mesh)
  const previewId = await createPreview(creature);
  const previewTask = await pollTask(previewId, "Preview");
  console.log(`    Preview succeeded (${previewTask.consumed_credits} credits)`);

  // Step 2: Refine (texture)
  const refineId = await createRefine(previewId);
  const refineTask = await pollTask(refineId, "Refine");
  console.log(`    Refine succeeded (${refineTask.consumed_credits} credits)`);

  // Step 3: Download .glb
  const glbUrl = refineTask.model_urls?.glb || previewTask.model_urls?.glb;
  if (!glbUrl) throw new Error("No GLB URL in response");

  const destPath = `public/models/${creature.id}.glb`;
  await downloadFile(glbUrl, destPath);

  return true;
}

async function main() {
  console.log("Meshy Creature Model Generator");
  console.log(`Generating ${CREATURES.length} creature models...`);
  console.log(`Estimated cost: ~260 credits\n`);

  let success = 0;
  for (const c of CREATURES) {
    try {
      await generateCreature(c);
      success++;
    } catch (err) {
      console.error(`  ❌ ${c.name} failed: ${err.message}`);
    }
  }

  console.log(`\n✅ Done! Generated ${success}/${CREATURES.length} models.`);
  console.log("Models are in public/models/ — they'll be auto-loaded by CreatureModel in-game.");
}

main().catch(console.error);
