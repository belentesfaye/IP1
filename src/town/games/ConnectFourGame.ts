/* eslint-disable no-continue */
import InvalidParametersError, {
  PLAYER_ALREADY_IN_GAME_MESSAGE,
  GAME_FULL_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
  GAME_NOT_STARTABLE_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  BOARD_POSITION_NOT_VALID_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
} from '../../lib/InvalidParametersError';
import Player from '../../lib/Player';
import { ConnectFourGameState, ConnectFourMove, GameMove } from '../../types/CoveyTownSocket';
import Game from './Game';

/**
 * A ConnectFourGame is a Game that implements the rules of Connect Four.
 * @see https://en.wikipedia.org/wiki/Connect_Four
 */
export default class ConnectFourGame extends Game<ConnectFourGameState, ConnectFourMove> {
  private _lastGame: ConnectFourGame | undefined;

  private readonly _board: string[][] = [
    ['_', '_', '_', '_', '_', '_', '_'],
    ['_', '_', '_', '_', '_', '_', '_'],
    ['_', '_', '_', '_', '_', '_', '_'],
    ['_', '_', '_', '_', '_', '_', '_'],
    ['_', '_', '_', '_', '_', '_', '_'],
    ['_', '_', '_', '_', '_', '_', '_'],
  ];

  /**
   * Creates a new ConnectFourGame.
   * @param priorGame If provided, the new game will be created such that if either player
   * from the prior game joins, they will be the same color. When the game begins, the default
   * first player is red, but if either player from the prior game joins the new game
   * (and clicks "start"), the first player will be the other color.
   */
  public constructor(priorGame?: ConnectFourGame) {
    super({
      moves: [],
      status: 'WAITING_FOR_PLAYERS',
      firstPlayer: 'Red',
    });
    this._lastGame = priorGame;
  }

  /**
   * Indicates that a player is ready to start the game.
   *
   * Updates the game state to indicate that the player is ready to start the game.
   *
   * If both players are ready, the game will start.
   *
   * The first player (red or yellow) is determined as follows:
   *   - If neither player was in the last game in this area (or there was no prior game), the first player is red.
   *   - If at least one player was in the last game in this area, then the first player will be the other color from last game.
   *   - If a player from the last game *left* the game and then joined this one, they will be treated as a new player (not given the same color by preference).   *
   *
   * @throws InvalidParametersError if the player is not in the game (PLAYER_NOT_IN_GAME_MESSAGE)
   * @throws InvalidParametersError if the game is not in the WAITING_TO_START state (GAME_NOT_STARTABLE_MESSAGE)
   *
   * @param player The player who is ready to start the game
   */
  public startGame(player: Player): void {
    if (this.state.status !== 'WAITING_TO_START') {
      throw new InvalidParametersError(GAME_NOT_STARTABLE_MESSAGE);
    }

    if (this.state.red !== player.id && this.state.yellow !== player.id) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }

    if (this.state.red === player.id || this.state.yellow === player.id) {
      if (
        this._lastGame &&
        this._players.some(
          p => p.id === this._lastGame?.state.red || p.id === this._lastGame?.state.yellow,
        )
      ) {
        if (this._lastGame?.state.firstPlayer === 'Red') {
          this.state.firstPlayer = 'Yellow';
        } else {
          this.state.firstPlayer = 'Red';
        }
      } else if (!this._lastGame) {
        this.state.firstPlayer = 'Red';
      }
    }

    if (this.state.red === player.id) {
      this.state.redReady = true;
    } else if (this.state.yellow === player.id) {
      this.state.yellowReady = true;
    }
    // set game to progress if both players are ready
    if (this.state.yellowReady && this.state.redReady) {
      this.state.status = 'IN_PROGRESS';
    }
  }

  /**
   * Joins a player to the game.
   * - Assigns the player to a color (red or yellow). If the player was in the prior game, then attempts
   * to reuse the same color if it is not in use. Otherwise, assigns the player to the first
   * available color (red, then yellow).
   * - If both players are now assigned, updates the game status to WAITING_TO_START.
   *
   * @throws InvalidParametersError if the player is already in the game (PLAYER_ALREADY_IN_GAME_MESSAGE)
   * @throws InvalidParametersError if the game is full (GAME_FULL_MESSAGE)
   *
   * @param player the player to join the game
   */
  protected _join(player: Player): void {
    // Check if the player is already in the game
    if (this.state.red === player.id || this.state.yellow === player.id) {
      throw new InvalidParametersError(PLAYER_ALREADY_IN_GAME_MESSAGE);
    }

    // Check if the game is full
    if (this.state.red && this.state.yellow && this.state.red !== this.state.yellow) {
      throw new InvalidParametersError(GAME_FULL_MESSAGE);
    }

    if (this._lastGame) {
      // If the player was in the last game, attempt to reuse the same color if it is not in use

      // If the player was red in the last game, and red is not in use, assign the player to red
      if (this.state.red === undefined && this._lastGame?.state.red === player.id) {
        this.state.red = player.id;
      }
      // If the player was yellow in the last game, and yellow is not in use, assign the player to yellow
      else if (this.state.yellow === undefined && this._lastGame?.state.yellow === player.id) {
        this.state.yellow = player.id;
      }
      // If the player was red in the last game, and red is in use, assign the player to yellow
      else if (this.state.red !== undefined && this._lastGame?.state.red === player.id) {
        this.state.yellow = player.id;
      }
      // If the player was yellow in the last game, and yellow is in use, assign the player to red
      else if (this.state.yellow !== undefined && this._lastGame?.state.yellow === player.id) {
        this.state.red = player.id;
      } else if (this.state.red === undefined) {
        this.state.red = player.id;
      } else {
        this.state.yellow = player.id;
      }
    } else if (!this._lastGame) {
      if (this.state.red === undefined) {
        this.state.red = player.id;
      } else {
        this.state.yellow = player.id;
      }
    }

    if (this.state.red !== undefined && this.state.yellow !== undefined) {
      this.state.status = 'WAITING_TO_START';
    }
  }

  /**
   * Removes a player from the game.
   * Updates the game's state to reflect the player leaving.
   *
   * If the game state is currently "IN_PROGRESS", updates the game's status to OVER and sets the winner to the other player.
   *
   * If the game state is currently "WAITING_TO_START", updates the game's status to WAITING_FOR_PLAYERS.
   *
   * If the game state is currently "WAITING_FOR_PLAYERS" or "OVER", the game state is unchanged.
   *
   * @param player The player to remove from the game
   * @throws InvalidParametersError if the player is not in the game (PLAYER_NOT_IN_GAME_MESSAGE)
   */
  protected _leave(player: Player): void {
    //  if the player is not in the game (PLAYER_NOT_IN_GAME_MESSAGE)
    if (this.state.red !== player.id && this.state.yellow !== player.id) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }

    // check if the player is in the game and the game is in progress
    // check if the player is red if so set the winner to yellow and status to over
    if (this.state.red === player.id && this.state.status === 'IN_PROGRESS') {
      this.state.winner = this.state.yellow;
      this.state.status = 'OVER';
    } else if (this.state.yellow === player.id && this.state.status === 'IN_PROGRESS') {
      this.state.winner = this.state.red;
      this.state.status = 'OVER';
    }

    // check if the player is in the game
    // check if the game already over before the player left
    // don't change the status if the game is over
    if (this.state.red === player.id || this.state.yellow === player.id) {
      if (this.state.status === 'OVER') {
        return;
      }
    }

    // check if the player is in the game
    // check if the game is waiting to start
    // check if that player leaves is red
    // set red to undefined, redReady to false and status to waiting for players
    if (this.state.red === player.id) {
      if (this.state.status === 'WAITING_TO_START') {
        this.state.red = undefined;
        this.state.redReady = false;
        this.state.status = 'WAITING_FOR_PLAYERS';
      }
    } else if (this.state.yellow === player.id) {
      if (this.state.status === 'WAITING_TO_START') {
        this.state.yellow = undefined;
        this.state.yellowReady = false;
        this.state.status = 'WAITING_FOR_PLAYERS';
      }
    }

    // check if the player is in the game
    // check if the game is waiting to start with status waiting to start
    // if there are two aplyer and the palyer that leaves is red
    // if a player who was the "preferred yellow" player later joins, join should add the new player as red
    if (this.state.red === player.id && this.state.status === 'WAITING_TO_START') {
      if (this.state.status === 'WAITING_TO_START') {
        if (this.state.red && this.state.yellow) {
          if (this.state.yellow === player.id) {
            this.state.firstPlayer = 'Red';
          }
        }
      }
    }

    // if the player is in the game when the game is waiting for players
    // if the player is red
    // it sets red to undefined, redReady to false and status remains WAITING_FOR_PLAYERS
    if (this.state.red === player.id) {
      if (this.state.status === 'WAITING_FOR_PLAYERS') {
        this.state.red = undefined;
        this.state.redReady = false;
        this.state.status = 'WAITING_FOR_PLAYERS';
      }
    } else if (this.state.yellow === player.id) {
      if (this.state.status === 'WAITING_FOR_PLAYERS') {
        this.state.yellow = undefined;
        this.state.yellowReady = false;
        this.state.status = 'WAITING_FOR_PLAYERS';
      }
    }

    if (this.state.status === 'OVER') {
      this._createNewGame();
    }
  }

  /**
   * Creates a new instance of the ConnectFourGame class.
   *
   * @returns A new ConnectFourGame instance.
   */
  private _createNewGame(): ConnectFourGame {
    const newGame = new ConnectFourGame();
    return newGame;
  }

  /**
   * Applies a move to the game.
   * Uses the player's ID to determine which color they are playing as (ignores move.gamePiece).
   *
   * Validates the move, and if it is valid, applies it to the game state.
   *
   * If the move ends the game, updates the game state to reflect the end of the game,
   * setting the status to "OVER" and the winner to the player who won (or "undefined" if it was a tie)
   *
   * @param move The move to attempt to apply
   *
   * @throws InvalidParametersError if the game is not in progress (GAME_NOT_IN_PROGRESS_MESSAGE)
   * @throws InvalidParametersError if the player is not in the game (PLAYER_NOT_IN_GAME_MESSAGE)
   * @throws INvalidParametersError if the move is not the player's turn (MOVE_NOT_YOUR_TURN_MESSAGE)
   * @throws InvalidParametersError if the move is invalid per the rules of Connect Four (BOARD_POSITION_NOT_VALID_MESSAGE)
   *
   */
  public applyMove(move: GameMove<ConnectFourMove>): void {
    this._checkValidMove(move);

    this.state = {
      ...this.state,
      moves: [...this.state.moves, move.move],
    };

    this._updateBoard(this.state.moves);
    this._determineWinner(move.move, this._board);
  }

  /**
   * Checks the validity of a move based on game state and rules.
   *
   * @param move The move to be checked for validity.
   * @throws InvalidParametersError if the game is not in progress (GAME_NOT_IN_PROGRESS_MESSAGE)
   * @throws InvalidParametersError if the player is not in the game (PLAYER_NOT_IN_GAME_MESSAGE)
   * @throws InvalidParametersError if the move is not the player's turn (MOVE_NOT_YOUR_TURN_MESSAGE)
   * @throws InvalidParametersError if the move is invalid per the rules of Connect Four (BOARD_POSITION_NOT_VALID_MESSAGE)
   */
  private _checkValidMove(move: GameMove<ConnectFourMove>): void {
    if (this.state.status !== 'IN_PROGRESS') {
      throw new InvalidParametersError(GAME_NOT_IN_PROGRESS_MESSAGE);
    }
    if (this.state.red !== move.playerID && this.state.yellow !== move.playerID) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }
    if (this.state.status === 'IN_PROGRESS' && this.state.red && !this._isTurn(move)) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    } else if (this.state.status === 'IN_PROGRESS' && this.state.yellow && !this._isTurn(move)) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    }
    if (!this._isTurn(move)) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    }
    if (!this._checkValidBoardPosition(move)) {
      throw new InvalidParametersError(BOARD_POSITION_NOT_VALID_MESSAGE);
    }
    // check the game is in progress, the player is in the game, but it is not their turn, and the move is not valid
  }

  /**
   * Checks if a board position for a move is valid.
   *
   * @param move The move to check for board position validity.
   * @returns True if the board position is valid, false otherwise.
   */
  private _checkValidBoardPosition(move: GameMove<ConnectFourMove>) {
    const { row } = move.move;
    const { col } = move.move;
    // Check if move is out of bounds
    if (col < 0 || col >= 7 || row < 0 || row >= 6) {
      return false;
    }
    // Check if move is on an empty space
    if (this._board[row][col] !== '_') {
      return false;
    }
    // Check if there is a piece below the move
    if (row !== 5 && this._board[row + 1][col] === '_') {
      return false;
    }
    return true;
  }

  /**
   * Updates the game board based on the provided moves.
   *
   * @param moves An array of moves to update the game board.
   */
  private _updateBoard(moves: ReadonlyArray<ConnectFourMove>): void {
    for (let i = 0; i < moves.length; i++) {
      const { row } = moves[i];
      const { col } = moves[i];
      const { gamePiece } = moves[i];
      this._board[row][col] = gamePiece === 'Red' ? 'R' : 'Y';
    }
  }

  /**
   * Determines if the last move results in a win and updates game state accordingly.
   *
   * @param move The last move made.
   * @param board The current game board.
   */
  private _determineWinner(move: ConnectFourMove, board: string[][]): void {
    // Check for horizontal win
    for (let row = 0; row < board.length; row++) {
      let counter = 1;
      for (let col = 1; col < board[row].length; col++) {
        if (board[row][col] !== '_' && board[row][col] === board[row][col - 1]) {
          counter++;
        } else {
          counter = 1;
        }
        if (counter === 4) {
          this.state.status = 'OVER';
          this.state.winner = move.gamePiece === 'Red' ? this.state.red : this.state.yellow;
          return;
        }
      }
    }
    // Check for vertical win
    for (let col = 0; col < 7; col++) {
      let counter = 1;
      for (let row = 1; row < board.length; row++) {
        if (board[row][col] !== '_' && board[row][col] === board[row - 1][col]) {
          counter++;
        } else {
          counter = 1;
        }
        if (counter === 4) {
          this.state.status = 'OVER';
          this.state.winner = move.gamePiece === 'Red' ? this.state.red : this.state.yellow;
          return;
        }
      }
    }

    // check diagonal top left to bottom right
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] === '_') {
          continue;
        }
        const gamePiece = board[row][col];
        if (
          board[row]?.[col] === gamePiece &&
          board[row + 1]?.[col + 1] === gamePiece &&
          board[row + 2]?.[col + 2] === gamePiece &&
          board[row + 3]?.[col + 3] === gamePiece
        ) {
          this._setWinnerAndGameOver(move);
          return;
        }
      }
    }

    // check diagonal bottom left to top right
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] === '_') {
          continue;
        }
        const gamePiece = board[row][col];
        if (
          board[row]?.[col] === gamePiece &&
          board[row - 1]?.[col + 1] === gamePiece &&
          board[row - 2]?.[col + 2] === gamePiece &&
          board[row - 3]?.[col + 3] === gamePiece
        ) {
          this._setWinnerAndGameOver(move);
          return;
        }
      }
    }

    // check if there is a tie
    // if there is a tie set the winner to undefined and status to over
    // check if all the spaces are filled
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] !== '_' && this.state.moves.length === 42) {
          this.state = {
            ...this.state,
            status: 'OVER',
            winner: undefined,
          };
          return;
        }
      }
    }
  }

  /**
   * Sets the winner and game status when a winning move is detected.
   *
   * @param move The winning move.
   */
  private _setWinnerAndGameOver(move: ConnectFourMove): void {
    this.state.winner = move.gamePiece === 'Red' ? this.state.red : this.state.yellow;
    this.state.status = 'OVER';
  }

  /**
   * Checks if it's the turn of the player making the move.
   *
   * @param move The move made by the player.
   * @returns True if it's the player's turn, false otherwise.
   */
  private _isTurn(move: GameMove<ConnectFourMove>): boolean {
    const currentPlayerIndex = this.state.moves.length % 2;
    const currentPlayer =
      currentPlayerIndex === 0
        ? this.state.firstPlayer
        : this._getOtherPlayerColor(this.state.firstPlayer);

    if (currentPlayer === 'Red' && move.playerID === this.state.red) {
      return true;
    }

    if (currentPlayer === 'Yellow' && move.playerID === this.state.yellow) {
      return true;
    }

    return false;
  }

  /**
   * Gets the color of the player who is not the current player.
   *
   * @param playerColor The color of the current player.
   * @returns The color of the other player.
   */
  private _getOtherPlayerColor(playerColor: 'Red' | 'Yellow'): 'Red' | 'Yellow' {
    return playerColor === 'Red' ? 'Yellow' : 'Red';
  }
}
