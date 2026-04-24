// 🎯 Directions
const directions = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]

// 🧠 Game State
let currentDirection = null
let startTime = 0
let score = 0
let totalRounds = 0

// 🎮 UI Elements (make sure these IDs exist in trainer.html)
const signalEl = document.getElementById("signal")
const resultEl = document.getElementById("result")
const scoreEl = document.getElementById("score")

// 🚀 Start Game
function startGame() {
    nextRound()
}

// 🔁 Next Round
function nextRound() {
    resultEl.innerText = ""

    // Pick random direction
    currentDirection = directions[Math.floor(Math.random() * directions.length)]

    // Show signal
    signalEl.innerText = getArrow(currentDirection)

    // Start timer
    startTime = Date.now()
}

// 🎯 Convert key → arrow
function getArrow(dir) {
    switch (dir) {
        case "ArrowLeft": return "⬅️"
        case "ArrowRight": return "➡️"
        case "ArrowUp": return "⬆️"
        case "ArrowDown": return "⬇️"
    }
}

// 🎮 Handle Input
document.addEventListener("keydown", function(e) {

    if (!currentDirection) return

    const reactionTime = Date.now() - startTime
    totalRounds++

    // ✅ Correct
    if (e.key === currentDirection) {
        score += calculateScore(reactionTime)
        resultEl.innerText = `✅ Correct | ${reactionTime} ms`
    } 
    // ❌ Wrong
    else {
        resultEl.innerText = `❌ Wrong | ${reactionTime} ms`
    }

    // Update score
    scoreEl.innerText = `Score: ${score}`

    // Next round after delay
    setTimeout(nextRound, 800)
})

// 🧠 Scoring Logic
function calculateScore(time) {
    if (time < 300) return 100
    if (time < 600) return 70
    if (time < 1000) return 40
    return 10
}

// ▶️ Start automatically
startGame()