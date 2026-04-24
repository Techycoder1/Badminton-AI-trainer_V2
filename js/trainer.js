// 🎯 Directions
const directions = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]

// 🧠 Game State
let currentDirection = null
let startTime = 0

let score = 0
let totalRounds = 0
let correct = 0
let totalTime = 0

// 🎮 Elements
const signalEl = document.getElementById("signal")
const reactionEl = document.getElementById("reaction")
const scoreEl = document.getElementById("score")
const accuracyEl = document.getElementById("accuracy")
const avgEl = document.getElementById("avg")
const roundsEl = document.getElementById("rounds")
const gameArea = document.getElementById("gameArea")

// 🚀 Start
function startGame() {
    score = 0
    totalRounds = 0
    correct = 0
    totalTime = 0

    nextRound()
}

// 🔁 Next Round
function nextRound() {
    gameArea.classList.remove("is-hit", "is-miss")

    reactionEl.classList.remove("visible")
    reactionEl.innerText = ""

    // Random direction
    currentDirection = directions[Math.floor(Math.random() * directions.length)]

    // Show arrow
    signalEl.innerText = getArrow(currentDirection)
    signalEl.className = "direction-display__text state-signal anim-flash"

    startTime = Date.now()
}

// 🎯 Arrow UI
function getArrow(dir) {
    switch (dir) {
        case "ArrowLeft": return "⬅️"
        case "ArrowRight": return "➡️"
        case "ArrowUp": return "⬆️"
        case "ArrowDown": return "⬇️"
    }
}

// 🎮 Input
document.addEventListener("keydown", function(e) {

    if (!currentDirection) return

    const reactionTime = Date.now() - startTime
    totalRounds++
    totalTime += reactionTime

    reactionEl.innerText = `${reactionTime} ms`
    reactionEl.classList.add("visible")

    // ✅ Correct
    if (e.key === currentDirection) {
        correct++
        score += calculateScore(reactionTime)

        signalEl.className = "direction-display__text state-hit anim-hit"
        gameArea.classList.add("is-hit")
    } 
    // ❌ Wrong
    else {
        signalEl.className = "direction-display__text state-miss"
        gameArea.classList.add("is-miss")
    }

    updateStats()

    setTimeout(nextRound, 800)
})

// 🧠 Score Logic
function calculateScore(time) {
    if (time < 300) return 100
    if (time < 600) return 70
    if (time < 1000) return 40
    return 10
}

// 📊 Update UI
function updateStats() {
    scoreEl.innerText = score
    roundsEl.innerText = `Rounds: ${totalRounds}`

    const acc = totalRounds ? Math.round((correct / totalRounds) * 100) : 0
    accuracyEl.innerText = acc + "%"

    const avg = totalRounds ? Math.round(totalTime / totalRounds) : 0
    avgEl.innerText = avg + " ms"
}