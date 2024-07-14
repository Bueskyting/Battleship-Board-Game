document.addEventListener('DOMContentLoaded', () => {
  const playerBoard = document.getElementById('player-board')
  const computerBoard = document.getElementById('computer-board')
  const startButton = document.getElementById('start-game')
  const restartButton = document.getElementById('restart-game')
  const surrenderButton = document.getElementById('surrender-game')
  const messageDiv = document.getElementById('message')
  const shipSizes = [1, 1, 1, 1, 1, 2, 3, 4, 5]
  let playerShips = []
  let computerShips = []
  let currentShipIndex = 0
  let isHorizontal = true
  let playerTurn = true
  let gameStarted = false
  let botHits = [] // To track bot's hits

  // Ship names for display
  const shipNames = ['Patrol Boat 1', 'Patrol Boat 2', 'Patrol Boat 3', 'Patrol Boat 4', 'Patrol Boat 5',  'Destroyer', 'Submarine', 'Battleship', 'Carrier']

  // Function to initialize the ship display
  const initializeShipDisplay = () => {
    const shipList = document.getElementById('ship-list')
    shipList.innerHTML = ''
    shipNames.forEach((name, index) => {
        const shipItem = document.createElement('div')
        shipItem.className = 'ship-item'
        shipItem.dataset.index = index
        shipItem.innerHTML = `
            <span class="ship-name">${name}</span>
            <span class="ship-status">[${'■'.repeat(shipSizes[index])}]</span>
        `
        shipList.appendChild(shipItem)
    })
  }

  // Call this function to update the ship display when a ship is destroyed
  const updateShipDisplay = () => {
      computerShips.forEach((ship, index) => {
          const allPositionsHit = ship.every(pos => computerBoard.querySelector(`[data-id='${pos}']`).classList.contains('hit'))
          if (allPositionsHit) {
              const shipItem = document.querySelector(`.ship-item[data-index='${index}']`)
              if (shipItem) {
                  shipItem.classList.add('destroyed')
                  shipItem.querySelector('.ship-status').textContent = '[X]'
              }
          }
      })
  }

  // Call the initializeShipDisplay function when the DOM is loaded
  initializeShipDisplay()

  // Create board function remains the same
  const createBoard = (board) => {
    for (let i = 0; i < 100; i++) {
      const square = document.createElement('div')
      square.dataset.id = i
      board.appendChild(square)
    }
  }

  createBoard(playerBoard)
  createBoard(computerBoard)

  // Function to play background music
  const playBackgroundMusic = () => {
    const backgroundMusic = document.getElementById('backgroundMusic0')
    backgroundMusic.volume = 0.05 // Set volume to 5%
    backgroundMusic.play()
  }

  // Function to place ships on the board remains the same
  const placeShips = (board, ships, isComputer = false) => {
    ships.forEach(ship => {
      ship.forEach(position => {
        if (!isComputer) {
          board.querySelector(`[data-id='${position}']`).classList.add('ship')
        }
      })
    })
  }

  // Function to generate a random integer
  const getRandomInt = (max) => Math.floor(Math.random() * max)

  // Function to check if ship placement is valid
  const isValidPlacement = (startIndex, shipSize, isHorizontal, ships) => {
    let valid = true
    let proposedPositions = []
    let adjacentPositions = []
    
    for (let i = 0; i < shipSize; i++) {
      let nextIndex = isHorizontal ? startIndex + i : startIndex + i * 10 // Calculate next index
      
      // Check if index is within board boundaries
      if (
        nextIndex >= 100 || // Check if index is out of upper boundary
        (isHorizontal && Math.floor(startIndex / 10) !== Math.floor(nextIndex / 10)) || // Check if next index changes row
        (!isHorizontal && nextIndex % 10 !== startIndex % 10) // Check if next index changes column
      ) {
        valid = false
        break
      }

      // Check if next index overlaps with existing ships
      if (ships.flat().includes(nextIndex)) {
        valid = false
        break
      }

      proposedPositions.push(nextIndex)
    }

    // Check for adjacency with existing ships
    proposedPositions.forEach(pos => {
      let adjacent = [
        pos - 10, pos + 10, // Top and bottom
        pos - 1, pos + 1, // Left and right
        pos - 11, pos - 9, // Top-left and top-right
        pos + 9, pos + 11 // Bottom-left and bottom-right
      ]

      adjacent.forEach(adj => {
        if (adj >= 0 && adj < 100 && ships.flat().includes(adj)) {
          valid = false
        }
        adjacentPositions.push(adj)
      })
    })

    return valid ? proposedPositions : false
  }

  // Function to place random ships for the computer
  const placeRandomShips = (board, shipSizes) => {
    let ships = []
    shipSizes.forEach(shipSize => {
      let placed = false
      while (!placed) {
        const isHorizontal = getRandomInt(2) === 0 // Randomly choose horizontal or vertical
        const startIndex = getRandomInt(100) // Randomly choose starting index
        const proposedPositions = isValidPlacement(startIndex, shipSize, isHorizontal, ships)
        if (proposedPositions) {
          ships.push(proposedPositions)
          placed = true
        }
      }
    })
    placeShips(board, ships, true)
    return ships
  }

  // Function to display message in messageDiv
  const displayMessage = (message) => {
    messageDiv.textContent = message
    messageDiv.style.display = 'block'
    setTimeout(() => {
      messageDiv.style.display = 'none'
    }, 3000)
  }

  // Event listener for handling player ship placement
  const handlePlayerPlacement = (e) => {
    if (gameStarted) return
    const target = e.target
    const startIndex = parseInt(target.dataset.id)
    const shipSize = shipSizes[currentShipIndex]
    const proposedPositions = isValidPlacement(startIndex, shipSize, isHorizontal, playerShips)

    if (proposedPositions) {
      proposedPositions.forEach(position => {
        playerBoard.querySelector(`[data-id='${position}']`).classList.add('ship')
      })
      playerShips.push(proposedPositions)
      currentShipIndex++
    } else {
      displayMessage('Vessels cannot be placed next to each other!')
    }

    if (currentShipIndex >= shipSizes.length) {
      playerBoard.removeEventListener('click', handlePlayerPlacement)
    }
  }

  // Function to handle player attacks on computer board
  const handleAttack = (board, ships, target) => {
    const index = parseInt(target.dataset.id)
    if (target.classList.contains('hit') || target.classList.contains('miss') || target.classList.contains('flagged')) return false

    if (ships.flat().includes(index)) {
      target.classList.add('hit')
      if (board === computerBoard) {
        board.querySelector(`[data-id='${index}']`).classList.add('ship')
      }
      return true
    } else {
      target.classList.add('miss')
      return false
    }
  }

  // Function for computer bot's turn
  const botTurn = () => {
    let successfulHit = false
    let randomIndex
    let target

    do {
      randomIndex = getRandomInt(100)
      if (!botHits.includes(randomIndex)) {
        target = playerBoard.querySelector(`[data-id='${randomIndex}']`)
        successfulHit = handleAttack(playerBoard, playerShips, target)
        botHits.push(randomIndex) // Track this hit
      }
    } while (successfulHit)

    playerTurn = true
  }

  // Function to show ship placement outline
  const showOutline = (e) => {
    if (gameStarted) return
    const target = e.target
    const startIndex = parseInt(target.dataset.id)
    const shipSize = shipSizes[currentShipIndex]
    const proposedPositions = isValidPlacement(startIndex, shipSize, isHorizontal, playerShips)

    removeOutline()

    if (proposedPositions) {
      proposedPositions.forEach(position => {
        playerBoard.querySelector(`[data-id='${position}']`).classList.add('outline')
      })
    }
  }

  // Function to remove ship placement outline
  const removeOutline = () => {
    const outlines = playerBoard.querySelectorAll('.outline')
    outlines.forEach(outline => {
      outline.classList.remove('outline')
    })
  }

  // Event listener to handle right-click for flagging on computer board
  const handleRightClick = (e) => {
    e.preventDefault()
    const target = e.target
    if (gameStarted && target.parentElement === computerBoard && !target.classList.contains('hit') && !target.classList.contains('miss')) {
      target.classList.toggle('flagged')
    }
  }

  // Function to check for game win conditions
  const checkWin = () => {
    const allComputerShipsSunk = computerShips.every(ship =>
      ship.every(position => computerBoard.querySelector(`[data-id='${position}']`).classList.contains('hit'))
    )
    const allPlayerShipsSunk = playerShips.every(ship =>
      ship.every(position => playerBoard.querySelector(`[data-id='${position}']`).classList.contains('hit'))
    )
  
    if (allComputerShipsSunk) {
      endGame('Player')
    } else if (allPlayerShipsSunk) {
      endGame('Bot')
    }
  }
  
  // Function to end the game and declare the winner
  const endGame = (winner) => {
    gameStarted = false
    if (winner === 'Player') {
      alert('Congratulations! You have sunk all enemy vessels. You won!')
    } else {
      alert('The enemy has sunk all your vessels. You lost!')
    }
    restartButton.style.display = 'block'
    surrenderButton.style.display = 'none' // Hide surrender button after game ends
    musicControlButton.style.display = 'none' // Hide music control button after game ends
  }

  // Event listener for player attacking computer board
  computerBoard.addEventListener('click', (e) => {
    if (!playerTurn || !gameStarted) return
    const target = e.target
  
    if (target.classList.contains('hit') || target.classList.contains('miss')) {
      displayMessage('You have already hit this spot!')
      return
    }
  
    const successfulHit = handleAttack(computerBoard, computerShips, target)
    checkWin()
    updateShipDisplay() // Update ship display after each attack
    if (!successfulHit) {
      playerTurn = false
      setTimeout(botTurn, 1000)
    }
  })

  // Event listener for handling player ship placement
  playerBoard.addEventListener('click', handlePlayerPlacement)
  
  // Event listener for displaying ship placement outline
  playerBoard.addEventListener('mouseover', showOutline)
  
  // Event listener for removing ship placement outline
  playerBoard.addEventListener('mouseout', removeOutline)
  
  // Event listener for right-click to flag cells on computer board
  computerBoard.addEventListener('contextmenu', handleRightClick)

  // Event listener for starting the game
  startButton.addEventListener('click', () => {
    if (currentShipIndex >= shipSizes.length) {
        computerShips = placeRandomShips(computerBoard, shipSizes)
        gameStarted = true
        startButton.style.display = 'none'
        restartButton.style.display = 'none'
        musicControlButton.style.display = 'block' // Display music control button after game starts

        // Enable background music
        playBackgroundMusic()

        // Enable surrender button after 30 seconds
        setTimeout(() => {
            if (gameStarted) {
                surrenderButton.style.display = 'inline-block'
            }
        }, 30000) // 30 seconds delay

        // Initialize ship display
        initializeShipDisplay()
    } else {
        alert('Place all your ships first!')
    }
  })

  // Event listener for restarting the game
  restartButton.addEventListener('click', () => {
    location.reload()
  })

  // Event listener for surrendering the game
  surrenderButton.addEventListener('click', () => {
    endGame('Bot') // Player surrenders, so Bot wins
  })

  // Event listener for rotating ships with the 'R' key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      isHorizontal = !isHorizontal
      removeOutline()
    }
  })

  // Function to toggle play/pause of background music
  const musicControlButton = document.getElementById('music-control')
  musicControlButton.addEventListener('click', () => {
    const backgroundMusic = document.getElementById('backgroundMusic0')
    if (backgroundMusic.paused) {
      backgroundMusic.play()
      musicControlButton.textContent = 'Pause Music'
    } else {
      backgroundMusic.pause()
      musicControlButton.textContent = 'Play Music'
    }
  })

  // Event listener to handle visual feedback on computer board during player's turn
  computerBoard.addEventListener('mouseover', (e) => {
    const target = e.target
    if (target.classList.contains('hit') || target.classList.contains('miss')) {
      target.classList.add('blocked')
    } else {
      target.classList.remove('blocked')
    }
  })

  // Initially hide the music control button
  musicControlButton.style.display = 'none'
})