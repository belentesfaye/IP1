import { Console } from 'console';
import InvalidParametersError, {
  BOARD_POSITION_NOT_VALID_MESSAGE,
  GAME_FULL_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  GAME_NOT_STARTABLE_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  PLAYER_ALREADY_IN_GAME_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
} from '../../lib/InvalidParametersError';
import { createPlayerForTesting } from '../../TestUtils';
import {
  ConnectFourColIndex,
  ConnectFourColor,
  ConnectFourMove,
  ConnectFourRowIndex,
} from '../../types/CoveyTownSocket';
import ConnectFourGame from './ConnectFourGame';

const logger = new Console(process.stdout, process.stderr);
/**
 * A helper function to apply a pattern of moves to a game.
 * The pattern is a 2-d array of Y, R or _.
 * Y and R indicate that a move should be made by the yellow or red player respectively.
 * _ indicates that no move should be made.
 * The pattern is applied from the bottom left to the top right, going across the rows
 *
 * Note that there are valid game boards that *can not* be created by this function, as it does not
 * search for all possible orderings of applying the moves. It might get stuck in a situation where
 * it can't make a move, because it hasn't made the move that would allow it to make the next move.
 *
 * If it fails, it will print to the console the pattern and the moves that were made, and throw an error.
 *
 * @param game Game to apply the pattern to
 * @param pattern Board pattern to apply
 * @param redID ID of the red player
 * @param yellowID ID of the yellow player
 * @param firstColor The color of the first player to make a move
 */
function createMovesFromPattern(
  game: ConnectFourGame,
  pattern: string[][],
  redID: string,
  yellowID: string,
  firstColor: ConnectFourColor,
) {
  type QueuedMove = { rowIdx: ConnectFourRowIndex; colIdx: ConnectFourColIndex };
  const queues = {
    Yellow: [] as QueuedMove[],
    Red: [] as QueuedMove[],
  };

  // Construct the queues of moves to make from the board pattern
  pattern.forEach((row, rowIdx) => {
    row.forEach((col, colIdx) => {
      if (col === 'Y') {
        queues.Yellow.push({
          rowIdx: rowIdx as ConnectFourRowIndex,
          colIdx: colIdx as ConnectFourColIndex,
        });
      } else if (col === 'R') {
        queues.Red.push({
          rowIdx: rowIdx as ConnectFourRowIndex,
          colIdx: colIdx as ConnectFourColIndex,
        });
      } else if (col !== '_') {
        throw new Error(`Invalid pattern: ${pattern}, expecting 2-d array of Y, R or _`);
      }
    });
  });

  // sort the queue so that the moves are made from the left to the right, then bottom to up
  const queueSorter = (a: QueuedMove, b: QueuedMove) => {
    function cellNumber(move: QueuedMove) {
      return 6 * (5 - move.rowIdx) + move.colIdx;
    }
    return cellNumber(a) - cellNumber(b);
  };
  queues.Yellow.sort(queueSorter);
  queues.Red.sort(queueSorter);

  const colHeights = [5, 5, 5, 5, 5, 5, 5];
  const movesMade: string[][] = [[], [], [], [], [], []];
  // Helper function to make a move
  const makeMove = (color: ConnectFourColor) => {
    // Finds the first move in the queue that can be made and makes it
    const queue = queues[color];
    if (queue.length === 0) return;
    for (const move of queue) {
      if (move.rowIdx === colHeights[move.colIdx]) {
        // we can make this!
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: color,
            col: move.colIdx,
            row: move.rowIdx,
          },
          playerID: color === 'Red' ? redID : yellowID,
        });
        movesMade[move.rowIdx][move.colIdx] = color === 'Red' ? 'R' : 'Y';
        queues[color] = queue.filter(m => m !== move);
        colHeights[move.colIdx] -= 1;
        return;
      }
    }
    // If we get here, we couldn't make any moves
    logger.table(pattern);
    logger.table(movesMade);
    throw new Error(
      `Unable to apply pattern: ${JSON.stringify(pattern, null, 2)}
      If this is a pattern in the autograder: are you sure that you checked for game-ending conditions? If this is a pattern you provided: please double-check your pattern - it may be invalid.`,
    );
  };
  const gameOver = () => game.state.status === 'OVER';
  while (queues.Yellow.length > 0 || queues.Red.length > 0) {
    // Try to make a move for the first player in the queue
    makeMove(firstColor);
    // If the game is over, return
    if (gameOver()) return;

    // Try to make a move for the second player in the queue
    makeMove(firstColor === 'Red' ? 'Yellow' : 'Red');
    if (gameOver()) return;
  }
}

describe('ConnectFourGame', () => {
  let game: ConnectFourGame;
  beforeEach(() => {
    game = new ConnectFourGame();
  });
  describe('_join', () => {
    it('should throw an error if the player is already in the game', () => {
      const player = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player);
      game.join(player2);
      expect(() => game.join(player)).toThrowError(PLAYER_ALREADY_IN_GAME_MESSAGE);
    });
    it('should throw an error if the player is already in the game', () => {
      const player = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player);
      game.join(player2);
      const newGame = new ConnectFourGame(game);
      newGame.join(player);
      newGame.join(player2);
      expect(() => newGame.join(player)).toThrowError(PLAYER_ALREADY_IN_GAME_MESSAGE);
      expect(() => game.join(player)).toThrowError(PLAYER_ALREADY_IN_GAME_MESSAGE);
    });
    it('should throw an error if the player is not in the game and the game is full', () => {
      const newGame = new ConnectFourGame();
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      const player3 = createPlayerForTesting();
      newGame.join(player1);
      newGame.join(player2);
      // check if the game is full
      expect(newGame.state.status).toBe('WAITING_TO_START');
      // Attempting to join player3 should throw an error since the color is already in use
      expect(() => newGame.join(player3)).toThrowError(GAME_FULL_MESSAGE);
    });
    it('should add the player to the game if the game is not full and the player is not already in the game', () => {
      const player = createPlayerForTesting();
      expect(() => game.join(player)).not.toThrow();
      // Ensure that the player is added to the game
      expect(game.state.status).toBe('WAITING_FOR_PLAYERS');
      expect(game.state.moves).toEqual([]);
      expect(game.state.firstPlayer).toBe('Red');

      const secondPlayer = createPlayerForTesting();
      expect(() => game.join(secondPlayer)).not.toThrow();
      expect(game.state.status).toBe('WAITING_TO_START');
      expect(game.state.moves).toEqual([]);
      expect(game.state.firstPlayer).toBe('Red');
    });
    it('if the player is not in the game and the game is not full if the player was not the yellow in the last game should add the player as yellow if red is present', () => {
      const lastGame = new ConnectFourGame();
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      lastGame.join(player1);
      lastGame.join(player2);

      const newGame = new ConnectFourGame(lastGame);

      const newPlayer = createPlayerForTesting();

      expect(newGame.state.red).toBeUndefined();
      expect(newGame.state.yellow).toBeUndefined();

      newGame.join(newPlayer);
      newGame.join(player1);
      expect(newGame.state.red).toBe(newPlayer.id);

      // check if red is present
      expect(newGame.state.red).toBe(newPlayer.id);
      // check if player was not yellow in last game
      expect(lastGame.state.yellow).not.toBe(player1.id);
      // add player2 to newGame
      // check if player1 is yellow
      expect(newGame.state.yellow).toBe(player1.id);
    });
    it('if the player is not in the game and the game is not full if the player was yellow in the last game should add the player as yellow if yellow is empty', () => {
      const lastGame = new ConnectFourGame();
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      lastGame.join(player1);
      lastGame.join(player2);
      lastGame.startGame(player1);
      // check player 2 is yellow in last game
      expect(lastGame.state.yellow).toBe(player2.id);
      const newGame = new ConnectFourGame(lastGame);
      // check player 2 is not in newGame
      expect(newGame.state.red).toBeUndefined();
      expect(newGame.state.yellow).toBeUndefined();
      // add player2 to newGame
      newGame.join(player2);
      // check if player2 is yellow
      expect(newGame.state.yellow).toBe(player2.id);
    });
    it('should set the status to WAITING_TO_START if the player is not in the game and the game is not full with both players present', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      // check if the game is not full
      expect(game.state.status).toBe('WAITING_FOR_PLAYERS');
      game.join(player1);
      game.join(player2);
      // check if both players are present
      expect(game.state.red).toBe(player1.id);
      expect(game.state.yellow).toBe(player2.id);
      expect(game.state.status).toBe('WAITING_TO_START');
    });
    it(' an edge case for joining the gam', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      const player3 = createPlayerForTesting();
      expect(() => game.join(player3)).toThrowError(GAME_FULL_MESSAGE);
    });
    it(' an edge case for joining the gam', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      const player3 = createPlayerForTesting();
      game.leave(player1);
      // check game status
      expect(game.state.status).toBe('WAITING_FOR_PLAYERS');
      game.join(player3);
      expect(() => game.join(player1)).toThrowError(GAME_FULL_MESSAGE);
    });
  });
  describe('_startGame', () => {
    it('if the status is not WAITING_TO_START, it throws an error', () => {
      // Attempt to start the game when status is not 'WAITING_TO_START'
      const player = createPlayerForTesting();
      game.join(player);
      expect(() => game.startGame(player)).toThrowError(GAME_NOT_STARTABLE_MESSAGE);
    });
    it('if the player is not in the game, it throws an error', () => {
      // Create a player who is not in the game
      const player = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player);
      game.join(player2);
      const player3 = createPlayerForTesting();
      // check if player3 is not in the game
      expect(game.state.red).toBe(player.id);
      expect(game.state.yellow).toBe(player2.id);
      // throw an error when the player is not in the game
      expect(() => game.startGame(player3)).toThrowError(PLAYER_NOT_IN_GAME_MESSAGE);
    });
    it('if the player is in the game if the player is red, it sets redReady to true', () => {
      const player = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player);
      game.join(player2);
      game.startGame(player);
      game.startGame(player2);
      expect(game.state.redReady).toBe(true);
    });
    it('if the player is in the game if the player is yellow, it sets yellowReady to true', () => {
      const player = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player);
      game.join(player2);
      game.startGame(player2);
      game.startGame(player);
      expect(game.state.yellowReady).toBe(true);
    });
    it('_startGame if the player is in the game if both players are ready, it sets the status to IN_PROGRESS', () => {
      const player = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player);
      game.join(player2);
      game.startGame(player);
      game.startGame(player2);
      expect(game.state.status).toBe('IN_PROGRESS');
    });
    it('if the player is in the game if a player already reported ready, it does not change the status or throw an error', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      // check if red is ready
      expect(game.state.redReady).toBe(true);
      game.startGame(player1);
      expect(game.state.status).toBe('WAITING_TO_START');
      game.startGame(player1);
      expect(game.state.status).toBe('WAITING_TO_START');
    });
    it('if the player is in the game if there are not any players from a prior game, it always sets the first player to red when the game starts', () => {
      const newGame = new ConnectFourGame();
      const player = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      newGame.join(player);
      newGame.join(player2);
      newGame.startGame(player);
      newGame.startGame(player2);
      expect(newGame.state.firstPlayer).toBe('Red');
    });
    it('if the player is in the game if there are players from a prior game, it sets the first player to the player who was not first in the last game', () => {
      const player = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player);
      game.join(player2);
      game.startGame(player);
      game.startGame(player2);

      // check if the first player is set to red
      expect(game.state.firstPlayer).toBe('Red');

      // create a new game
      const newGame = new ConnectFourGame(game);
      newGame.join(player);
      newGame.join(player2);

      expect(newGame.state.status).toBe('WAITING_TO_START');
      newGame.startGame(player);
      newGame.startGame(player2);

      // check if the first player is set to yellow
      expect(newGame.state.firstPlayer).toBe('Yellow');
    });
  });
  describe('_leave', () => {
    it('should throw an error if the player is not in the game', () => {
      const player = createPlayerForTesting(); // Create a player for testing
      // Ensure the initial state is as expected
      expect(game.state.red).toBeUndefined();
      expect(game.state.yellow).toBeUndefined();

      // Attempt to leave the game without joining first
      expect(() => game.leave(player)).toThrowError(PLAYER_NOT_IN_GAME_MESSAGE);
    });
    it('when the player is in the game when the game is in progress if the player is red, it sets the winner to yellow and status to OVER', () => {
      // Create two players
      const redPlayer = createPlayerForTesting();
      const yellowPlayer = createPlayerForTesting();
      // Join players to the game
      game.join(redPlayer);
      game.join(yellowPlayer);
      // Start the game
      game.startGame(redPlayer);
      game.startGame(yellowPlayer);
      game.state.status = 'IN_PROGRESS';
      // Remove the red player from the game
      game.leave(redPlayer);
      // Check if the game state is updated correctly
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe(yellowPlayer.id);
    });
    it('when the player is in the game when the game is in progress if the player is yellow, it sets the winner to red and status to OVER', () => {
      // Create two players
      const redPlayer = createPlayerForTesting();
      const yellowPlayer = createPlayerForTesting();
      // Join players to the game
      game.join(redPlayer);
      game.join(yellowPlayer);
      // Start the game
      game.startGame(redPlayer);
      game.state.status = 'IN_PROGRESS';
      // Remove the yellow player from the game
      game.leave(yellowPlayer);
      // Check if the game state is updated correctly
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe(redPlayer.id);
    });
    it('when the player is in the game when the game is already over before the player leaves, it does not update the state', () => {
      const redPlayer = createPlayerForTesting();
      const yellowPlayer = createPlayerForTesting();
      // Join players to the game
      game.join(redPlayer);
      game.join(yellowPlayer);
      // Start the game
      game.startGame(redPlayer);
      game.state.status = 'OVER';
      game.leave(yellowPlayer);
      // Check if the game state is updated correctly
      expect(game.state.status).toBe('OVER');
    });
    it('when the player is in the game when the game is waiting to start, with status WAITING_TO_START if the player that leaves is red, it sets red to undefined and status to WAITING_FOR_PLAYERS', () => {
      const redPlayer = createPlayerForTesting();
      const yellowPlayer = createPlayerForTesting();
      // Join players to the game
      game.join(redPlayer);
      game.join(yellowPlayer);
      // Start the game
      game.state.status = 'WAITING_TO_START';
      game.leave(redPlayer);
      // check that red is undefined and status is WAITING_FOR_PLAYERS
      expect(game.state.red).toBeUndefined();
      expect(game.state.status).toBe('WAITING_FOR_PLAYERS');
    });
    it('when the player is in the game when the game is waiting to start, with status WAITING_TO_START if the player that leaves is yellow, it sets yellow to undefined and status to WAITING_FOR_PLAYERS', () => {
      const redPlayer = createPlayerForTesting();
      const yellowPlayer = createPlayerForTesting();
      // Join players to the game
      game.join(redPlayer);
      game.join(yellowPlayer);
      // Start the game
      game.state.status = 'WAITING_TO_START';
      game.leave(yellowPlayer);
      // check that red is undefined and status is WAITING_FOR_PLAYERS
      expect(game.state.yellow).toBeUndefined();
      expect(game.state.status).toBe('WAITING_FOR_PLAYERS');
    });
    it('when the player is in the game when the game is waiting to start, with status WAITING_TO_START if there are two players, and the player that leaves is red, if a player who was the "preferred yellow" player later joins, join should add the new player as red', () => {
      const lastGame = new ConnectFourGame();
      const playerRed = createPlayerForTesting();
      const playerYellow = createPlayerForTesting();
      console.log('Step 1: Initial State');
      console.log(lastGame.state);
      lastGame.join(playerRed);
      lastGame.join(playerYellow);
      lastGame.startGame(playerRed);
      console.log('Step 2: After playerRed and playerYellow join and playerRed starts the game');
      console.log(lastGame.state);
      // check playerRed is red
      expect(lastGame.state.red).toBe(playerRed.id);
      // check playerYellow is yellow
      expect(lastGame.state.yellow).toBe(playerYellow.id);

      const newGame = new ConnectFourGame(lastGame);
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();

      console.log('Step 3: After creating newGame from lastGame');
      console.log(newGame.state);
      newGame.join(player1);
      newGame.join(player2);

      console.log('Step 4: After player1 and player2 join newGame');
      console.log(newGame.state);

      newGame.leave(player1);

      console.log('Step 5: After player1 leaves newGame');
      console.log(newGame.state);
      newGame.join(playerYellow);

      console.log('Step 6: After playerYellow joins newGame');
      console.log(newGame.state);
      // check playerYellow is red
      expect(newGame.state.red).toBe(playerYellow.id);
    });
    it('when the player is in the game when the game is waiting for players, in state WAITING_FOR_PLAYERS if the player is red, it sets red to undefined, redReady to false and status remains WAITING_FOR_PLAYERS', () => {
      // Create a player
      const redPlayer = createPlayerForTesting();

      // Join the player to the game
      game.join(redPlayer);

      // Remove the red player from the game
      game.leave(redPlayer);

      // Check if the game state is updated correctly
      expect(game.state.status).toBe('WAITING_FOR_PLAYERS');
      expect(game.state.red).toBeUndefined();
      expect(game.state.redReady).toBe(false);
    });
    it('when the player is in the game when the game is waiting for players, in state WAITING_FOR_PLAYERS if the player is yellow, it sets yellow to undefined, yellowReady to false and status remains WAITING_FOR_PLAYERS', () => {
      // Create a player
      const yellowPlayer = createPlayerForTesting();
      const redPlayer = createPlayerForTesting();

      // Join the player to the game
      game.join(redPlayer);
      game.join(yellowPlayer);

      // Remove the yellow player from the game
      game.leave(yellowPlayer);

      // Check if the game state is updated correctly
      expect(game.state.status).toBe('WAITING_FOR_PLAYERS');
      expect(game.state.yellow).toBeUndefined();
      expect(game.state.yellowReady).toBe(false);
    });
  });
  describe('test applyMove', () => {
    it('Determining who is the first player If there is no prior game, the first player is red', () => {
      const newGame = new ConnectFourGame();
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      newGame.join(player1);
      newGame.join(player2);
      newGame.startGame(player1);
      expect(newGame.state.firstPlayer).toBe('Red');
    });
    it('Determining who is the first player If there is a prior game, and both players join this one, then the first player is the player who was NOT first in the last game', () => {
      const lastGame = new ConnectFourGame();
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      lastGame.join(player1);
      lastGame.join(player2);
      lastGame.startGame(player1);
      const newGame = new ConnectFourGame(lastGame);
      newGame.join(player1);
      newGame.join(player2);
      newGame.startGame(player1);
      expect(newGame.state.firstPlayer).toBe('Yellow');
    });
    it('Determining who is the first player If there is a prior game, and only one player joins this one, then that player will be first if they were NOT first in the last game', () => {
      const lastGame = new ConnectFourGame();
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      lastGame.join(player1);
      lastGame.join(player2);
      lastGame.startGame(player1);
      const newGame = new ConnectFourGame(lastGame);
      const player3 = createPlayerForTesting();
      // check which player was first in the last game
      expect(lastGame.state.firstPlayer).toBe('Red');
      newGame.join(player2);
      newGame.join(player3);
      newGame.startGame(player2);
      // check if player2 is first
      expect(newGame.state.firstPlayer).toBe('Yellow');
    });
  });
  describe('applyMove', () => {
    const red = createPlayerForTesting();
    const yellow = createPlayerForTesting();
    beforeEach(() => {
      game.join(red);
      game.join(yellow);
      game.startGame(red);
      game.startGame(yellow);
    });

    describe('Determining who is the first player', () => {
      test('If there is no prior game, the first player is red', () => {
        expect(game.state.firstPlayer).toEqual('Red');
      });
      test('if there is a prior game, and both players join this one, then the first player is the player who was NOT first in the last game', () => {
        const newGame = new ConnectFourGame(game);
        newGame.join(red);
        newGame.join(yellow);
        newGame.startGame(red);
        newGame.startGame(yellow);
        expect(newGame.state.firstPlayer).toBe('Yellow');
      });
      test('If there is a prior game, and only one player joins this one, then that player will be first if they were NOT first in the last game', () => {
        const newGame = new ConnectFourGame(game);
        const player3 = createPlayerForTesting();
        newGame.join(red);
        newGame.join(player3);
        newGame.startGame(red);
        newGame.startGame(player3);
        expect(newGame.state.firstPlayer).toBe('Yellow');
      });
    });
    describe('when given a move that does not win the game, it does not end it', () => {
      test('Sample test', () => {
        createMovesFromPattern(
          game,
          [
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', 'Y', 'Y', '_', '_', '_', '_'],
            ['_', 'R', 'R', '_', '_', '_', '_'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
    });
    describe('when given a valid move in column 1-6, it adds the move and does not end the game', () => {
      test('Valid move in column 0', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 0,
            row: 5,
          },
          playerID: red.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 0,
            row: 5,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      test('A move is invalid if it is not at the bottom of the column', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 0,
            row: 5,
          },
          playerID: red.id,
        });
        // Attempt to make an invalid move in the same column but not at the bottom
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Yellow',
              col: 1,
              row: 4, // Not at the bottom
            },
            playerID: yellow.id,
          });
        }).toThrow();
      });
      test('Valid move in column 1', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 1,
            row: 5,
          },
          playerID: red.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 1,
            row: 5,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      test('Valid move in column 2', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 2,
            row: 5,
          },
          playerID: red.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 2,
            row: 5,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      test('Valid move in column 3', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 3,
            row: 5,
          },
          playerID: red.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 3,
            row: 5,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      test('Valid move in column 4', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 4,
            row: 5,
          },
          playerID: red.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 4,
            row: 5,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      test('Valid move in column 5', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 5,
            row: 5,
          },
          playerID: red.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 5,
            row: 5,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      test('Valid move in column 6', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 6,
            row: 5,
          },
          playerID: red.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 6,
            row: 5,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      test(' results in row-based-wins being detected when they do not exist', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 0,
            row: 5,
          },
          playerID: red.id,
        });
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Yellow',
            col: 1,
            row: 5,
          },
          playerID: yellow.id,
        });
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 2,
            row: 5,
          },
          playerID: red.id,
        });
        // Assert that the game is still in progress with no winner
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
    });
    describe('when given a valid move should permit stacking', () => {
      test('the moves in column 0 and not end the game if the move does not win', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 0,
            row: 5,
          },
          playerID: red.id,
        });
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Yellow',
            col: 0,
            row: 4,
          },
          playerID: yellow.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 0,
            row: 5,
          },
          {
            gamePiece: 'Yellow',
            col: 0,
            row: 4,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      it('the moves in column 1 and not end the game if the move does not win', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 1,
            row: 5,
          },
          playerID: red.id,
        });
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Yellow',
            col: 1,
            row: 4,
          },
          playerID: yellow.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 1,
            row: 5,
          },
          {
            gamePiece: 'Yellow',
            col: 1,
            row: 4,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      it('the moves in column 2 and not end the game if the move does not win', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 2,
            row: 5,
          },
          playerID: red.id,
        });
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Yellow',
            col: 2,
            row: 4,
          },
          playerID: yellow.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 2,
            row: 5,
          },
          {
            gamePiece: 'Yellow',
            col: 2,
            row: 4,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      it('the moves in column 3 and not end the game if the move does not win', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 3,
            row: 5,
          },
          playerID: red.id,
        });
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Yellow',
            col: 3,
            row: 4,
          },
          playerID: yellow.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 3,
            row: 5,
          },
          {
            gamePiece: 'Yellow',
            col: 3,
            row: 4,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      it('the moves in column 4 and not end the game if the move does not win', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 4,
            row: 5,
          },
          playerID: red.id,
        });
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Yellow',
            col: 4,
            row: 4,
          },
          playerID: yellow.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 4,
            row: 5,
          },
          {
            gamePiece: 'Yellow',
            col: 4,
            row: 4,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      it('the moves in column 5 and not end the game if the move does not win', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 5,
            row: 5,
          },
          playerID: red.id,
        });
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Yellow',
            col: 5,
            row: 4,
          },
          playerID: yellow.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 5,
            row: 5,
          },
          {
            gamePiece: 'Yellow',
            col: 5,
            row: 4,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      it('the moves in column 6 and not end the game if the move does not win', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 6,
            row: 5,
          },
          playerID: red.id,
        });
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Yellow',
            col: 6,
            row: 4,
          },
          playerID: yellow.id,
        });
        expect(game.state.moves).toEqual([
          {
            gamePiece: 'Red',
            col: 6,
            row: 5,
          },
          {
            gamePiece: 'Yellow',
            col: 6,
            row: 4,
          },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
    });
    describe('when given a move that wins the game', () => {
      it('should end the game when four in a row is achieved horizontally', () => {
        createMovesFromPattern(
          game,
          [
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['R', 'R', '_', '_', '_', '_', '_'],
            ['R', 'Y', 'Y', 'Y', 'Y', '_', 'R'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toEqual(yellow.id);
      });
      it('should end the game when four in a row is achieved horizontally', () => {
        createMovesFromPattern(
          game,
          [
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['R', 'Y', '_', '_', '_', '_', 'Y'],
            ['R', 'R', 'R', 'R', 'R', 'R', 'Y'],
            ['R', 'Y', 'Y', 'Y', 'R', 'Y', 'R'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toEqual(red.id);
      });
      it('should end the game when four in a row is achieved vertically', () => {
        createMovesFromPattern(
          game,
          [
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', 'R', '_', '_', '_'],
            ['_', '_', 'Y', 'R', '_', '_', '_'],
            ['_', '_', 'Y', 'R', '_', '_', '_'],
            ['_', '_', 'Y', 'R', '_', '_', '_'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toEqual(red.id);
      });
      it('should end the game when four in a row is achieved vertically', () => {
        createMovesFromPattern(
          game,
          [
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', 'Y', 'R', '_', '_', '_'],
            ['_', 'Y', 'Y', 'R', '_', '_', '_'],
            ['_', 'R', 'Y', 'R', '_', '_', '_'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 3,
            row: 2,
          },
          playerID: red.id,
        });
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toEqual(red.id);
      });
      it('it ends the game and declares the winner diagonal wins', () => {
        createMovesFromPattern(
          game,
          [
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', 'Y'],
            ['_', '_', '_', '_', '_', 'Y', 'R'],
            ['R', '_', '_', '_', 'Y', 'R', 'R'],
            ['Y', 'R', 'Y', 'Y', 'Y', 'R', 'R'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toEqual(yellow.id);
      });
      it('should end the game as a tie when the board is full', () => {
        createMovesFromPattern(
          game,
          [
            ['Y', 'R', 'Y', 'R', 'Y', 'R', 'Y'],
            ['R', 'Y', 'R', 'Y', 'R', 'Y', 'R'],
            ['R', 'Y', 'R', 'Y', 'R', 'Y', 'R'],
            ['Y', 'R', 'Y', 'R', 'Y', 'R', 'Y'],
            ['Y', 'R', 'Y', 'R', 'Y', 'R', 'Y'],
            ['R', 'Y', 'R', 'Y', 'R', 'Y', 'R'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBeUndefined();
      });
      it('check for boards do not result in a player winning - even when they are close to winning', () => {
        createMovesFromPattern(
          game,
          [
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['R', '_', '_', '_', '_', '_', '_'],
            ['R', 'Y', 'R', '_', '_', '_', '_'],
            ['Y', 'R', 'Y', '_', '_', '_', '_'],
            ['R', 'R', 'Y', 'Y', '_', '_', '_'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
    });
    describe('when given a move that does not win the game', () => {
      it('it does not end it Near-win horizontally', () => {
        createMovesFromPattern(
          game,
          [
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['_', '_', '_', '_', '_', '_', '_'],
            ['R', 'R', '_', '_', '_', '_', '_'],
            ['R', 'Y', 'Y', 'Y', '_', '_', 'R'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
    });
    describe('when given an invalid move request throws an error', () => {
      it('if the game is not in progress, it throws an error', () => {
        // Attempt to make a move when the game is not in progress
        // check if the game is not in progress
        expect(game.state.status).toBe('IN_PROGRESS');
        game.leave(red);
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 0,
              row: 5,
            },
            playerID: red.id,
          });
        }).toThrowError(GAME_NOT_IN_PROGRESS_MESSAGE);
      });
      it('when the game is in progress should throw an error if the player is not in the game', () => {
        // Create a player who is not in the game
        const player = createPlayerForTesting();
        // Attempt to make a move when the player is not in the game
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 0,
              row: 5,
            },
            playerID: player.id,
          });
        }).toThrowError(PLAYER_NOT_IN_GAME_MESSAGE);
      });
      it('when the game is in progress when the player is in the game should throw an error if the cell is not at the bottom of the column', () => {
        // Attempt to make a move when the cell is not at the bottom of the column
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 0,
              row: 4,
            },
            playerID: red.id,
          });
        }).toThrowError(BOARD_POSITION_NOT_VALID_MESSAGE);
      });
      it(' when the game is in progress when the player is in the game should throw an error if the cell is full', () => {
        createMovesFromPattern(
          game,
          [
            ['Y', 'R', 'Y', 'R', 'Y', 'R', 'Y'],
            ['R', 'Y', 'R', 'Y', 'R', 'Y', 'R'],
            ['R', 'Y', 'R', 'Y', 'R', 'Y', 'R'],
            ['Y', 'R', 'Y', 'R', 'Y', 'R', 'Y'],
            ['Y', 'R', 'Y', 'R', 'Y', 'R', 'Y'],
            ['R', 'Y', 'R', 'Y', 'R', 'Y', 'R'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 0,
              row: 5,
            },
            playerID: red.id,
          });
        }).toThrowError(GAME_NOT_IN_PROGRESS_MESSAGE);
      });
      it('when given an invalid move request when the game is in progress when the player is in the game should throw an error if the player is not the active player', () => {
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 0,
              row: 5,
            },
            playerID: yellow.id,
          });
        });
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Yellow',
              col: 0,
              row: 5,
            },
            playerID: yellow.id,
          });
        }).toThrowError(MOVE_NOT_YOUR_TURN_MESSAGE);
      });
      it('when the game is in progress when the player is in the game should not change the game state if the move is invalid', () => {
        // Attempt to make a move when the move is invalid
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 0,
              row: 4,
            },
            playerID: red.id,
          });
        }).toThrowError(BOARD_POSITION_NOT_VALID_MESSAGE);
        // Ensure the game state is not changed
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
      });
      it('when given a move that wins the game, it ends the game and declares the winner horizontal wins in the first row', () => {
        createMovesFromPattern(
          game,
          [
            ['_', '_', '_', '_', '_', '_', '_'],
            ['R', 'R', '_', 'R', 'Y', '_', '_'],
            ['R', 'Y', 'Y', 'Y', 'R', '_', '_'],
            ['Y', 'Y', 'R', 'R', 'Y', '_', '_'],
            ['R', 'R', 'Y', 'R', 'Y', '_', '_'],
            ['R', 'Y', 'R', 'Y', 'Y', '_', '_'],
          ],
          red.id,
          yellow.id,
          'Red',
        );
        expect(game.state.status).toBe('IN_PROGRESS');
        // apply move at row 1 column 2
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 2,
            row: 1,
          },
          playerID: red.id,
        });
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(red.id);
      });
    });
    describe('take into account both turns', () => {
      test('yellow turn after red turn', () => {
        const newGame = new ConnectFourGame(game);
        newGame.join(red);
        newGame.join(yellow);
        newGame.startGame(red);
        newGame.startGame(yellow);
        console.log('player 1 id is', red.id);
        console.log('player 2 id is', yellow.id);
        console.log('first player is', newGame.state.firstPlayer);
        // check if the first player is set to yellow
        expect(newGame.state.firstPlayer).toBe('Yellow');
        expect(newGame.state.status).toBe('IN_PROGRESS');
        newGame.applyMove({
          gameID: newGame.id,
          move: {
            gamePiece: 'Yellow',
            col: 2,
            row: 5,
          },
          playerID: yellow.id,
        });
      });
      test('results in an incorrect turn order when yellow moves first', () => {
        const newGame = new ConnectFourGame(game);
        newGame.join(red);
        newGame.join(yellow);
        newGame.startGame(yellow);
        newGame.startGame(red);
        // check if the first player is set to yellow
        expect(newGame.state.firstPlayer).toBe('Yellow');
        expect(newGame.state.status).toBe('IN_PROGRESS');
        // throw error when red moves first
        expect(() => {
          newGame.applyMove({
            gameID: newGame.id,
            move: {
              gamePiece: 'Red',
              col: 2,
              row: 5,
            },
            playerID: red.id,
          });
        }).toThrowError(MOVE_NOT_YOUR_TURN_MESSAGE);
      });
      test('check whether the turn *comes back* to a player after the opponent makes a move', () => {
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Red',
            col: 2,
            row: 5,
          },
          playerID: red.id,
        });
        expect(() =>
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Yellow',
              col: 3,
              row: 5,
            },
            playerID: red.id,
          }),
        ).toThrowError(MOVE_NOT_YOUR_TURN_MESSAGE);
        game.applyMove({
          gameID: game.id,
          move: {
            gamePiece: 'Yellow',
            col: 2,
            row: 4,
          },
          playerID: yellow.id,
        });
        expect(() =>
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 2,
              row: 3,
            },
            playerID: yellow.id,
          }),
        ).toThrowError(MOVE_NOT_YOUR_TURN_MESSAGE);
      });
      test('Make sure that the move is only applied if the game is in progress', () => {
        // Attempt to make a move when the game is not in progress
        // check if the game is not in progress
        expect(game.state.status).toBe('IN_PROGRESS');
        game.leave(red);
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 0,
              row: 5,
            },
            playerID: red.id,
          });
        }).toThrowError(GAME_NOT_IN_PROGRESS_MESSAGE);
      });
      test('Check if the player making the move is actually part of the game', () => {
        // Create a player who is not in the game
        const player = createPlayerForTesting();
        // Attempt to make a move when the player is not in the game
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 0,
              row: 5,
            },
            playerID: player.id,
          });
        }).toThrowError(PLAYER_NOT_IN_GAME_MESSAGE);
      });
      test('Check for edge cases or invalid input values.', () => {
        // Attempt to make a move when the cell is not at the bottom of the column
        expect(() => {
          game.applyMove({
            gameID: game.id,
            move: {
              gamePiece: 'Red',
              col: 6,
              row: 1,
            },
            playerID: red.id,
          });
        }).toThrowError();
      });
      test('process moves, update board, and determine winner in correct order', () => {
        const moves: ConnectFourMove[] = [
          { gamePiece: 'Red', col: 0, row: 5 },
          { gamePiece: 'Yellow', col: 1, row: 5 },
          { gamePiece: 'Red', col: 2, row: 5 },
          // Add more moves as needed
        ];
        for (const move of moves) {
          game.applyMove({
            gameID: game.id,
            move,
            playerID: move.gamePiece === 'Red' ? red.id : yellow.id,
          });
        }
        expect(game.state.moves.map(move => move)).toEqual(moves.map(move => move));
      });
    });
  });
});
