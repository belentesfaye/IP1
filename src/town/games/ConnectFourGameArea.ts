import InvalidParametersError, {
  GAME_ID_MISSMATCH_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  INVALID_COMMAND_MESSAGE,
} from '../../lib/InvalidParametersError';
import Player from '../../lib/Player';
import {
  ConnectFourGameState,
  ConnectFourMove,
  GameInstance,
  GameMove,
  GameMoveCommand,
  InteractableCommand,
  InteractableCommandReturnType,
  InteractableType,
  JoinGameCommand,
  StartGameCommand,
} from '../../types/CoveyTownSocket';
import ConnectFourGame from './ConnectFourGame';
import GameArea from './GameArea';

/**
 * The ConnectFourGameArea class is responsible for managing the state of a single game area for Connect Four.
 * Responsibilty for managing the state of the game itself is delegated to the ConnectFourGame class.
 *
 * @see ConnectFourGame
 * @see GameArea
 */
export default class ConnectFourGameArea extends GameArea<ConnectFourGame> {
  protected getType(): InteractableType {
    return 'ConnectFourArea';
  }

  // it similar to the one in tic-tac-toe
  // don't complicate it
  private _stateUpdated(updatedState: GameInstance<ConnectFourGameState>) {
    if (updatedState.state.status === 'OVER') {
      // If we haven't yet recorded the outcome, do so now.
      const gameID = this._game?.id;
      if (gameID && !this._history.find(eachResult => eachResult.gameID === gameID)) {
        const { red, yellow } = updatedState.state;
        if (red && yellow) {
          const redName =
            this._occupants.find(eachPlayer => eachPlayer.id === red)?.userName || red;
          const yellowName =
            this._occupants.find(eachPlayer => eachPlayer.id === yellow)?.userName || yellow;
          this._history.push({
            gameID,
            scores: {
              [redName]: updatedState.state.winner === red ? 1 : 0,
              [yellowName]: updatedState.state.winner === yellow ? 1 : 0,
            },
          });
        }
      }
    }
    this._emitAreaChanged();
  }

  /**
   * Handle a command from a player in this game area.
   * Supported commands:
   * - JoinGame (joins the game `this._game`, or creates a new one if none is in progress)
   * - StartGame (indicates that the player is ready to start the game)
   * - GameMove (applies a move to the game)
   * - LeaveGame (leaves the game)
   *
   * If the command ended the game, records the outcome in this._history
   * If the command is successful (does not throw an error), calls this._emitAreaChanged (necessary
   * to notify any listeners of a state update, including any change to history)
   * If the command is unsuccessful (throws an error), the error is propagated to the caller
   *
   * @see InteractableCommand
   *
   * @param command command to handle
   * @param player player making the request
   * @returns response to the command, @see InteractableCommandResponse
   * @throws InvalidParametersError if the command is not supported or is invalid.
   * Invalid commands:
   * - GameMove, StartGame and LeaveGame: if the game is not in progress (GAME_NOT_IN_PROGRESS_MESSAGE) or if the game ID does not match the game in progress (GAME_ID_MISSMATCH_MESSAGE)
   * - Any command besides JoinGame, GameMove, StartGame and LeaveGame: INVALID_COMMAND_MESSAGE
   */
  public handleCommand<CommandType extends InteractableCommand>(
    command: CommandType,
    player: Player,
  ): InteractableCommandReturnType<CommandType> {
    switch (command.type) {
      case 'JoinGame':
        return this._handleJoinGame(player) as InteractableCommandReturnType<CommandType>;
      case 'StartGame':
        return this._handleStartGame(
          player,
          command.gameID,
        ) as InteractableCommandReturnType<CommandType>;
      case 'GameMove':
        return this._handleGameMove(
          player,
          command.gameID,
          command as GameMoveCommand<ConnectFourMove>,
        ) as InteractableCommandReturnType<CommandType>;
      case 'LeaveGame':
        return this._handleLeaveGame(
          player,
          command.gameID,
        ) as InteractableCommandReturnType<CommandType>;
      default:
        throw new InvalidParametersError(INVALID_COMMAND_MESSAGE);
    }
  }

  /**
   * Handles the player leaving the Connect Four game.
   *
   * @param player The player leaving the game.
   * @param gameID The ID of the game.
   * @throws Error if the game is not in progress.
   * @throws Error if the provided game ID does not match the active game.
   */
  private _handleLeaveGame(player: Player, gameID: string) {
    if (!this._game) {
      throw new Error(GAME_NOT_IN_PROGRESS_MESSAGE);
    }
    if (this._game.id !== gameID) {
      throw new Error(GAME_ID_MISSMATCH_MESSAGE);
    }
    this._game.leave(player);
    this._stateUpdated(this._game.toModel());
  }

  /**
   * Handles a game move made by a player in the Connect Four game.
   *
   * @param player The player making the move.
   * @param gameID The ID of the game.
   * @param command The game move command containing the move details.
   * @returns Undefined, as there is no specific return type for game moves.
   * @throws Error if the game is not in progress.
   * @throws Error if the provided game ID does not match the active game.
   */
  private _handleGameMove(
    player: Player,
    gameID: string,
    command: GameMoveCommand<ConnectFourMove>,
  ): InteractableCommandReturnType<GameMoveCommand<ConnectFourMove>> {
    if (!this._game) {
      throw new Error(GAME_NOT_IN_PROGRESS_MESSAGE);
    }
    if (this._game.id !== gameID) {
      throw new Error(GAME_ID_MISSMATCH_MESSAGE);
    }
    const gameMove: GameMove<ConnectFourMove> = {
      playerID: player.id,
      gameID: this._game.id,
      move: command.move,
    };
    this._game.applyMove(gameMove);
    this._stateUpdated(this._game.toModel());
    return undefined as InteractableCommandReturnType<GameMoveCommand<ConnectFourMove>>;
  }

  /**
   * Handles starting the Connect Four game.
   *
   * @param player The player starting the game.
   * @param gameID The ID of the game.
   * @returns The game ID as part of the return type.
   * @throws Error if the game is not in progress.
   * @throws Error if the provided game ID does not match the active game.
   */
  private _handleStartGame(
    player: Player,
    gameID: string,
  ): InteractableCommandReturnType<StartGameCommand> {
    if (!this._game) {
      throw new Error(GAME_NOT_IN_PROGRESS_MESSAGE);
    }
    if (this._game.id !== gameID) {
      throw new Error(GAME_ID_MISSMATCH_MESSAGE);
    }
    this._game.startGame(player);
    this._emitAreaChanged();
    return { gameID: this._game.id } as InteractableCommandReturnType<StartGameCommand>;
  }

  /**
   * Handles a player joining the Connect Four game.
   *
   * @param player The player joining the game.
   * @returns The game ID as part of the return type.
   */
  private _handleJoinGame(player: Player): InteractableCommandReturnType<JoinGameCommand> {
    if (!this._game || this._game.state.status === 'OVER') {
      this._game = new ConnectFourGame();
      this._game.join(player);
      this._emitAreaChanged();
      return { gameID: this._game.id };
    }
    if (this._game.state.status === 'IN_PROGRESS') {
      this._game.join(player);
      this._emitAreaChanged();
    }
    this._game.join(player);
    this._emitAreaChanged();
    return { gameID: this._game.id };
  }
}
