const $ = (id) => document.getElementById(id);

let mode = "smart";
let voice = "Female";
let lastResult = null;

function counter(input, out) {
  const update = () => $(out).textContent = input.value.length;
  input.addEventListener("input", update); update();
}
counter($("prompt"), "promptCount");
counter($("lyrics"), "lyricsCount");

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  btn.classList.add("active"); mode = btn.dataset.mode;
}));

document.querySelectorAll("#voiceChips .chip").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("#voiceChips .chip").forEach(x => x.classList.remove("active"));
  btn.classList.add("active"); voice = btn.dataset.value;
}));

document.querySelectorAll(".style-chip").forEach(btn => btn.addEventListener("click", () => {
  const field = $("style");
  const value = btn.textContent.trim();
  const parts = field.value.split(",").map(x => x.trim()).filter(Boolean);
  if (!parts.includes(value)) parts.push(value);
  field.value = parts.join(", ");
}));

$("advancedToggle").addEventListener("click", () => {
  $("advancedBody").classList.toggle("hidden");
});

$("infoBtn").addEventListener("click", () => {
  alert("NaRye Song Generator turns your creative prompt into a structured production brief, then sends it to the music engine. Detailed prompts can include lyrics, pauses, spoken moments, vocal direction, arrangement and production notes.");
});

$("writeAi").addEventListener("click", async () => {
  if (!$("prompt").value.trim() && !$("lyrics").value.trim()) {
    $("prompt").value = "Write a soulful song about ";
    $("prompt").focus();
    return;
  }
  setStatus("Interpreting your material...");
  try {
    const data = await post("/api/interpret", collect());
    $("dna").textContent = JSON.stringify(data.brief, null, 2);
    $("status").classList.remove("error");
    setStatus("Prompt interpreted. Review your fields, then generate the song.");
  } catch (e) { setStatus(e.message, true); }
});

function collect() {
  return {
    mode,
    prompt: $("prompt").value.trim(),
    lyrics: $("lyrics").value.trim(),
    style: $("style").value.trim(),
    title: $("title").value.trim(),
    voice,
    instrumental: $("instrumental").checked,
    tempo: $("tempo")?.value.trim() || "",
    key: $("key")?.value.trim() || "",
    mood: $("mood")?.value.trim() || ""
  };
}

async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function setStatus(text, error=false) {
  $("status").textContent = text;
  $("status").classList.remove("hidden");
  $("status").classList.toggle("error", error);
}

$("generateBtn").addEventListener("click", async () => {
  const data = collect();
  if (!data.prompt && !data.lyrics && !data.style) {
    setStatus("Give me a song idea, lyrics, or style first.", true); return;
  }
  $("generateBtn").disabled = true;
  $("result").classList.add("hidden");
  setStatus("NaRye is interpreting your prompt and generating the song. This can take a little while...");
  try {
    lastResult = await post("/api/generate", data);
    $("resultTitle").textContent = lastResult.title || data.title || "Untitled Song";
    $("player").src = lastResult.audio;
    $("dna").textContent = JSON.stringify(lastResult.brief, null, 2);
    $("result").classList.remove("hidden");
    setStatus("Song generated.");
    $("result").scrollIntoView({behavior:"smooth", block:"start"});
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    $("generateBtn").disabled = false;
  }
});

$("downloadBtn").addEventListener("click", () => {
  if (!lastResult?.audio) return;
  const a = document.createElement("a");
  a.href = lastResult.audio;
  a.download = `${(lastResult.title || "narye-song").replace(/[^\w\- ]+/g,"").trim()}.mp3`;
  a.click();
});

$("newTakeBtn").addEventListener("click", () => {
  $("generateBtn").click();
});

$("saveBtn").addEventListener("click", () => {
  if (!lastResult) return;
  const saved = JSON.parse(localStorage.getItem("naryeSongs") || "[]");
  saved.unshift({
    id: Date.now(),
    title: lastResult.title || "Untitled Song",
    audio: lastResult.audio,
    brief: lastResult.brief
  });
  localStorage.setItem("naryeSongs", JSON.stringify(saved.slice(0, 10)));
  renderSaved();
  setStatus("Saved to this device.");
});

function renderSaved() {
  const list = $("savedList");
  const saved = JSON.parse(localStorage.getItem("naryeSongs") || "[]");
  if (!saved.length) {
    list.innerHTML = '<div class="empty">Your saved generations will appear here.</div>';
    return;
  }
  list.innerHTML = saved.map(s => `
    <div class="saved-item">
      <span>${escapeHtml(s.title)}</span>
      <button data-id="${s.id}">▶</button>
    </div>`).join("");
  list.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
    const song = saved.find(x => String(x.id) === btn.dataset.id);
    if (!song) return;
    lastResult = song;
    $("resultTitle").textContent = song.title;
    $("player").src = song.audio;
    $("dna").textContent = JSON.stringify(song.brief, null, 2);
    $("result").classList.remove("hidden");
    $("result").scrollIntoView({behavior:"smooth"});
  }));
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
renderSaved();
