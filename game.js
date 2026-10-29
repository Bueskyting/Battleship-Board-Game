document.addEventListener('DOMContentLoaded', () => {
  const SIZE = 10
  const BOT_SHOT_DELAY = 700 // ms between bot shots

  const playerBoard = document.getElementById('player-board')
  const computerBoard = document.getElementById('computer-board')
  const playerShipList = document.getElementById('player-ship-list')
  const computerShipList = document.getElementById('computer-ship-list')
  const statusEl = document.getElementById('status')
  const placementControls = document.getElementById('placement-controls')
  const gameControls = document.getElementById('game-controls')
  const startButton = document.getElementById('start-game')
  const rotateButton = document.getElementById('rotate-ship')
  const undoButton = document.getElementById('undo-ship')
  const randomButton = document.getElementById('random-ships')
  const clearButton = document.getElementById('clear-ships')
  const difficultySelect = document.getElementById('difficulty')
  const surrenderButton = document.getElementById('surrender-game')
  const restartButton = document.getElementById('restart-game')
  const musicControlButton = document.getElementById('music-control')
  const backgroundMusic = document.getElementById('backgroundMusic0')
  const gameOverOverlay = document.getElementById('game-over')
  const gameOverTitle = document.getElementById('game-over-title')
  const gameOverText = document.getElementById('game-over-text')

  // Fleet, largest first so manual placement doesn't paint you into a corner
  const fleet = [
    { name: 'Carrier', size: 5 },
    { name: 'Battleship', size: 4 },
    { name: 'Submarine', size: 3 },
    { name: 'Destroyer', size: 2 },
    { name: 'Patrol Boat 1', size: 1 },
    { name: 'Patrol Boat 2', size: 1 },
    { name: 'Patrol Boat 3', size: 1 },
    { name: 'Patrol Boat 4', size: 1 },
    { name: 'Patrol Boat 5', size: 1 }
  ]

  // Game state
  let player // { ships, shots, cells }
  let computer
  let isHorizontal = true
  let phase = 'placing' // 'placing' | 'playing' | 'over'
  let playerTurn = true
  let hoverIndex = null
  let gameId = 0 // bumped on reset so pending bot timeouts can tell they're stale
  let stats = { shots: 0, hits: 0 }

  // ---------- Helpers ----------

  const getRandomInt = (max) => Math.floor(Math.random() * max)
  const rowOf = (i) => Math.floor(i / SIZE)
  const colOf = (i) => i % SIZE
  const coordName = (i) => `${'ABCDEFGHIJ'[colOf(i)]}${rowOf(i) + 1}`

  // All in-bounds cells touching i (including diagonals), without wrapping across rows
  const neighbors = (i) => {
    const result = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const r = rowOf(i) + dr
        const c = colOf(i) + dc
        if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) result.push(r * SIZE + c)
      }
    }
    return result
  }

  // The on-board part of a ship starting at startIndex (cut off at the edge)
  const shipFootprint = (startIndex, size, horizontal) => {
    const cells = []
    for (let i = 0; i < size; i++) {
      const r = rowOf(startIndex) + (horizontal ? 0 : i)
      const c = colOf(startIndex) + (horizontal ? i : 0)
      if (r < SIZE && c < SIZE) cells.push(r * SIZE + c)
    }
    return cells
  }

  // Cells a ship would occupy, or null if it falls off the board
  const getShipCells = (startIndex, size, horizontal) => {
    const cells = shipFootprint(startIndex, size, horizontal)
    return cells.length === size ? cells : null
  }

  // Ships may not overlap or touch, not even diagonally
  const canPlace = (cells, ships) => {
    if (!cells) return false
    const blocked = new Set()
    ships.forEach(ship => ship.cells.forEach(cell => {
      blocked.add(cell)
      neighbors(cell).forEach(n => blocked.add(n))
    }))
    return cells.every(cell => !blocked.has(cell))
  }

  const makeShip = (def, cells) => ({ name: def.name, size: def.size, cells, hits: new Set() })
  const isSunk = (ship) => ship.hits.size === ship.size

  const randomFleet = () => {
    // Retry the whole fleet if a layout gets stuck (rare, but possible)
    for (let attempt = 0; attempt < 100; attempt++) {
      const ships = []
      const ok = fleet.every(def => {
        for (let tries = 0; tries < 500; tries++) {
          const cells = getShipCells(getRandomInt(SIZE * SIZE), def.size, getRandomInt(2) === 0)
          if (canPlace(cells, ships)) {
            ships.push(makeShip(def, cells))
            return true
          }
        }
        return false
      })
      if (ok) return ships
    }
    throw new Error('Could not place fleet')
  }

  // ---------- Board setup ----------

  const createBoard = (board) => {
    board.innerHTML = ''
    const cells = []
    for (let i = 0; i < SIZE * SIZE; i++) {
      const square = document.createElement('div')
      square.dataset.id = i
      board.appendChild(square)
      cells.push(square)
    }
    return cells
  }

  // A-J / 1-10 coordinate labels around each board
  document.querySelectorAll('.board-frame').forEach(frame => {
    const cols = frame.querySelector('.col-labels')
    const rows = frame.querySelector('.row-labels')
    for (let i = 0; i < SIZE; i++) {
      cols.insertAdjacentHTML('beforeend', `<span>${'ABCDEFGHIJ'[i]}</span>`)
      rows.insertAdjacentHTML('beforeend', `<span>${i + 1}</span>`)
    }
  })

  const cellIndex = (e) => {
    const id = e.target && e.target.dataset ? e.target.dataset.id : undefined
    return id === undefined ? null : parseInt(id)
  }

  // ---------- Rendering ----------

  const renderShipList = (listEl, ships, hidePending) => {
    listEl.innerHTML = ''
    fleet.forEach((def, index) => {
      const ship = ships[index]
      const item = document.createElement('div')
      item.className = 'ship-item'
      const name = document.createElement('span')
      name.className = 'ship-name'
      name.textContent = def.name
      const status = document.createElement('span')
      status.className = 'ship-status'

      if (!ship) {
        // Player fleet during placement
        item.classList.add(index === ships.length ? 'current' : 'pending')
        status.textContent = `[${'■'.repeat(def.size)}]`
      } else if (isSunk(ship)) {
        item.classList.add('destroyed')
        status.textContent = '[X]'
      } else if (hidePending) {
        status.textContent = `[${'■'.repeat(def.size)}]`
      } else {
        status.textContent = `[${ship.cells.map(c => ship.hits.has(c) ? '✕' : '■').join('')}]`
      }
      item.append(name, status)
      listEl.appendChild(item)
    })
  }

  const renderFleets = () => {
    renderShipList(playerShipList, player.ships, false)
    renderShipList(computerShipList, computer.ships, true)
  }

  const setStatus = (text, mode = '') => {
    statusEl.textContent = text
    statusEl.className = `status ${mode}`
  }

  const updatePlacementStatus = () => {
    const next = fleet[player.ships.length]
    if (next) {
      setStatus(`Place your ${next.name} (${next.size}) — ${isHorizontal ? 'horizontal' : 'vertical'}. Press R to rotate.`)
    } else {
      setStatus('Fleet ready! Pick a difficulty and press Start Game.')
    }
    startButton.disabled = player.ships.length < fleet.length
    undoButton.disabled = player.ships.length === 0
    clearButton.disabled = player.ships.length === 0
    rotateButton.disabled = player.ships.length >= fleet.length
  }

  // ---------- Placement ----------

  const removeOutline = () => {
    player.cells.forEach(cell => cell.classList.remove('outline', 'outline-invalid'))
  }

  const showOutline = () => {
    removeOutline()
    if (phase !== 'placing' || hoverIndex === null) return
    const def = fleet[player.ships.length]
    if (!def) return
    const valid = canPlace(getShipCells(hoverIndex, def.size, isHorizontal), player.ships)
    // Show the part that fits even when invalid, so the player sees why
    shipFootprint(hoverIndex, def.size, isHorizontal)
      .forEach(i => player.cells[i].classList.add(valid ? 'outline' : 'outline-invalid'))
  }

  const drawPlayerShips = () => {
    player.cells.forEach(cell => cell.classList.remove('ship'))
    player.ships.forEach(ship => ship.cells.forEach(i => player.cells[i].classList.add('ship')))
  }

  const afterPlacementChange = () => {
    drawPlayerShips()
    showOutline()
    renderFleets()
    updatePlacementStatus()
  }

  const handlePlayerPlacement = (e) => {
    if (phase !== 'placing') return
    const index = cellIndex(e)
    if (index === null) return
    const def = fleet[player.ships.length]
    if (!def) return
    const cells = getShipCells(index, def.size, isHorizontal)
    if (!canPlace(cells, player.ships)) return
    player.ships.push(makeShip(def, cells))
    afterPlacementChange()
  }

  const rotate = () => {
    if (phase !== 'placing') return
    isHorizontal = !isHorizontal
    showOutline()
    updatePlacementStatus()
  }

  // ---------- Combat ----------

  // Fires at a cell on a side. Returns { result: 'miss' | 'hit' | 'sunk', ship }
  const fireAt = (side, index) => {
    side.shots.add(index)
    const cell = side.cells[index]
    side.cells.forEach(c => c.classList.remove('last-shot'))
    cell.classList.remove('flagged')
    cell.classList.add('last-shot')

    const ship = side.ships.find(s => s.cells.includes(index))
    if (!ship) {
      cell.classList.add('miss')
      return { result: 'miss' }
    }

    ship.hits.add(index)
    cell.classList.add('hit')
    if (!isSunk(ship)) return { result: 'hit', ship }

    // Sunk: mark the ship and, since ships can't touch, all water around it
    ship.cells.forEach(i => side.cells[i].classList.add('sunk'))
    ship.cells.forEach(i => neighbors(i).forEach(n => {
      if (!side.shots.has(n)) {
        side.shots.add(n)
        side.cells[n].classList.remove('flagged')
        side.cells[n].classList.add('miss', 'auto')
      }
    }))
    return { result: 'sunk', ship }
  }

  const allSunk = (side) => side.ships.every(isSunk)

  // ---------- Bot AI ----------

  // Cells the bot has hit on ships that aren't sunk yet
  const openHits = () => player.ships
    .filter(ship => !isSunk(ship))
    .flatMap(ship => ship.cells.filter(c => ship.hits.has(c)))

  const unshotCells = () => {
    const cells = []
    for (let i = 0; i < SIZE * SIZE; i++) if (!player.shots.has(i)) cells.push(i)
    return cells
  }

  // Cells next to open hits (lined up with them if there are several)
  const targetCandidates = (hits) => {
    if (hits.length === 0) return []
    const candidates = new Set()
    const sameRow = hits.every(h => rowOf(h) === rowOf(hits[0]))
    const sameCol = hits.every(h => colOf(h) === colOf(hits[0]))

    hits.forEach(h => {
      const r = rowOf(h)
      const c = colOf(h)
      const options = []
      if (hits.length === 1 || sameRow) options.push([r, c - 1], [r, c + 1])
      if (hits.length === 1 || sameCol) options.push([r - 1, c], [r + 1, c])
      options.forEach(([nr, nc]) => {
        const n = nr * SIZE + nc
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !player.shots.has(n)) candidates.add(n)
      })
    })
    return [...candidates]
  }

  // How many ways the remaining enemy ships could cover each cell
  const probabilityMap = (hits) => {
    const weights = new Array(SIZE * SIZE).fill(0)
    const hitSet = new Set(hits)
    const remaining = player.ships.filter(s => !isSunk(s)).map(s => s.size)

    remaining.forEach(size => {
      for (let start = 0; start < SIZE * SIZE; start++) {
        [true, false].forEach(horizontal => {
          if (size === 1 && !horizontal) return // don't double count 1x1 ships
          const cells = getShipCells(start, size, horizontal)
          if (!cells) return
          // A placement is possible if every cell is unshot or an open hit
          if (!cells.every(c => !player.shots.has(c) || hitSet.has(c))) return
          const covered = cells.filter(c => hitSet.has(c)).length
          // While hunting a wounded ship, only placements through its hits count (and count a lot)
          if (hits.length > 0 && covered === 0) return
          const weight = hits.length > 0 ? Math.pow(10, covered) : 1
          cells.forEach(c => {
            if (!player.shots.has(c)) weights[c] += weight
          })
        })
      }
    })
    return weights
  }

  const pickRandom = (cells) => cells[getRandomInt(cells.length)]

  const pickBest = (cells, weights) => {
    const max = Math.max(...cells.map(c => weights[c]))
    return pickRandom(cells.filter(c => weights[c] === max))
  }

  const chooseBotTarget = () => {
    const difficulty = difficultySelect.value
    const free = unshotCells()
    if (difficulty === 'easy') return pickRandom(free)

    const hits = openHits()
    if (difficulty === 'normal') {
      const targets = targetCandidates(hits)
      return targets.length > 0 ? pickRandom(targets) : pickRandom(free)
    }

    // Hard: probability density, focused on the wounded ship if there is one
    const weights = probabilityMap(hits)
    const targets = targetCandidates(hits)
    if (targets.length > 0) return pickBest(targets, weights)
    // Checkerboard parity only helps once all the 1x1 boats are gone
    const smallest = Math.min(...player.ships.filter(s => !isSunk(s)).map(s => s.size))
    const pool = smallest >= 2 ? free.filter(c => (rowOf(c) + colOf(c)) % 2 === 0) : free
    return pickBest(pool.length > 0 ? pool : free, weights)
  }

  const botTurn = (id) => {
    if (id !== gameId || phase !== 'playing') return // game was reset or ended meanwhile

    const index = chooseBotTarget()
    const { result, ship } = fireAt(player, index)
    renderFleets()

    if (allSunk(player)) {
      endGame('Bot')
      return
    }

    if (result === 'miss') {
      playerTurn = true
      computerBoard.classList.add('active')
      setStatus(`Bot missed at ${coordName(index)}. Your turn — fire!`, 'player-turn')
      return
    }

    const msg = result === 'sunk' ? `Bot sank your ${ship.name}!` : `Bot hit at ${coordName(index)}!`
    setStatus(`${msg} It fires again…`, 'bot-turn')
    setTimeout(() => botTurn(id), BOT_SHOT_DELAY)
  }

  // ---------- Player attacks ----------

  const handleAttack = (e) => {
    if (phase !== 'playing' || !playerTurn) return
    const index = cellIndex(e)
    if (index === null) return
    // Already shot, or flagged as empty by the player: ignore and keep the turn
    if (computer.shots.has(index) || computer.cells[index].classList.contains('flagged')) return

    stats.shots++
    const { result, ship } = fireAt(computer, index)
    renderFleets()

    if (result === 'miss') {
      playerTurn = false
      computerBoard.classList.remove('active')
      setStatus(`Miss at ${coordName(index)}. Bot is aiming…`, 'bot-turn')
      const id = gameId
      setTimeout(() => botTurn(id), BOT_SHOT_DELAY * 1.5)
      return
    }

    stats.hits++
    if (allSunk(computer)) {
      endGame('Player')
      return
    }
    const msg = result === 'sunk' ? `You sank the enemy ${ship.name}!` : `Hit at ${coordName(index)}!`
    setStatus(`${msg} Fire again.`, 'player-turn')
  }

  const handleRightClick = (e) => {
    e.preventDefault()
    if (phase !== 'playing') return
    const index = cellIndex(e)
    if (index === null || computer.shots.has(index)) return
    computer.cells[index].classList.toggle('flagged')
  }

  // ---------- Music ----------

  let musicAvailable = false
  backgroundMusic.volume = 0.05 // Set volume to 5%
  backgroundMusic.addEventListener('canplay', () => {
    musicAvailable = true
    if (phase === 'playing') musicControlButton.hidden = false
  })

  const playBackgroundMusic = () => {
    if (!musicAvailable) return
    backgroundMusic.play()
      .then(() => { musicControlButton.textContent = 'Pause Music' })
      .catch(() => { musicControlButton.textContent = 'Play Music' })
  }

  musicControlButton.addEventListener('click', () => {
    if (backgroundMusic.paused) {
      playBackgroundMusic()
    } else {
      backgroundMusic.pause()
      musicControlButton.textContent = 'Play Music'
    }
  })

  // ---------- Game flow ----------

  const startGame = () => {
    if (player.ships.length < fleet.length) return
    computer.ships = randomFleet()
    phase = 'playing'
    playerTurn = true
    removeOutline()
    playerBoard.classList.remove('placing')
    computerBoard.classList.add('active')
    placementControls.hidden = true
    gameControls.hidden = false
    musicControlButton.hidden = !musicAvailable
    renderFleets()
    setStatus('Battle stations! Fire at the enemy board.', 'player-turn')
    playBackgroundMusic()
  }

  const endGame = (winner) => {
    phase = 'over'
    gameId++ // cancels any pending bot shots
    playerTurn = false
    computerBoard.classList.remove('active')
    gameControls.hidden = true
    backgroundMusic.pause()

    // Reveal the enemy ships that survived
    computer.ships.forEach(ship => ship.cells.forEach(i => {
      if (!ship.hits.has(i)) computer.cells[i].classList.add('revealed')
    }))
    renderShipList(computerShipList, computer.ships, false)

    const accuracy = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0
    const summary = `${stats.shots} shots fired, ${stats.hits} hits (${accuracy}% accuracy).`
    if (winner === 'Player') {
      gameOverTitle.textContent = 'Victory!'
      gameOverText.textContent = `Congratulations! You have sunk all enemy vessels. ${summary}`
      setStatus('You won!', 'player-turn')
    } else {
      const shipsLeft = player.ships.filter(s => !isSunk(s)).length
      gameOverTitle.textContent = 'Defeat'
      gameOverText.textContent = shipsLeft
        ? `You surrendered with ${shipsLeft} vessel${shipsLeft === 1 ? '' : 's'} still afloat. ${summary}`
        : `The enemy has sunk all your vessels. ${summary}`
      setStatus('You lost!', 'bot-turn')
    }

    // Let the final shot render before the modal covers the board
    setTimeout(() => {
      gameOverOverlay.hidden = false
      restartButton.focus()
    }, 600)
  }

  const resetGame = () => {
    gameId++
    phase = 'placing'
    playerTurn = true
    stats = { shots: 0, hits: 0 }
    player = { ships: [], shots: new Set(), cells: createBoard(playerBoard) }
    computer = { ships: [], shots: new Set(), cells: createBoard(computerBoard) }
    playerBoard.classList.add('placing')
    computerBoard.classList.remove('active')
    placementControls.hidden = false
    gameControls.hidden = true
    gameOverOverlay.hidden = true
    backgroundMusic.pause()
    backgroundMusic.currentTime = 0
    renderFleets()
    updatePlacementStatus()
  }

  // ---------- Event listeners ----------

  playerBoard.addEventListener('click', handlePlayerPlacement)
  playerBoard.addEventListener('mouseover', (e) => {
    hoverIndex = cellIndex(e)
    showOutline()
  })
  playerBoard.addEventListener('mouseleave', () => {
    hoverIndex = null
    removeOutline()
  })
  // Right-click on your own board rotates during placement
  playerBoard.addEventListener('contextmenu', (e) => {
    if (phase !== 'placing') return
    e.preventDefault()
    rotate()
  })

  computerBoard.addEventListener('click', handleAttack)
  computerBoard.addEventListener('contextmenu', handleRightClick)

  rotateButton.addEventListener('click', rotate)
  undoButton.addEventListener('click', () => {
    player.ships.pop()
    afterPlacementChange()
  })
  clearButton.addEventListener('click', () => {
    player.ships = []
    afterPlacementChange()
  })
  randomButton.addEventListener('click', () => {
    player.ships = randomFleet()
    afterPlacementChange()
  })
  startButton.addEventListener('click', startGame)
  surrenderButton.addEventListener('click', () => {
    if (phase === 'playing' && confirm('Surrender this battle?')) endGame('Bot')
  })
  restartButton.addEventListener('click', resetGame)

  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') rotate()
  })

  resetGame()
})
