/**
 * Diplomacy System Tests - Phase 8
 *
 * Testing the diplomacy system per Holden's architecture.
 * - Alliance offers require acceptance
 * - War declarations are unilateral
 * - Peace proposals require acceptance
 * - Only 2-player relationships
 */

import {
  DiplomaticStatus,
  DiplomaticAction,
  getDiplomaticStatus,
  validateDiplomaticAction,
  applyDiplomaticAction,
  getAllDiplomaticRelations,
  getPendingOffersFor,
  areAllied,
  areAtWar,
  type GameWorldWithDiplomacy,
  type DiplomaticActionRequest,
} from '../systems/diplomacy';

import { GameEventType, NodeStatus } from '../types';

// Test fixtures
function createTestWorld(): GameWorldWithDiplomacy {
  return {
    id: 'world-1',
    currentTick: 0,
    speed: 1,
    isPaused: false,
    nodes: {
      'node-1': {
        id: 'node-1',
        name: 'Alpha',
        position: { x: 0, y: 0 },
        status: NodeStatus.Claimed,
        ownerId: 'player-1',
        resources: [],
        connectionIds: [],
      },
      'node-2': {
        id: 'node-2',
        name: 'Beta',
        position: { x: 10, y: 10 },
        status: NodeStatus.Claimed,
        ownerId: 'player-2',
        resources: [],
        connectionIds: [],
      },
    },
    connections: {},
    eventQueue: [],
    diplomaticRelations: new Map(),
    pendingOffers: [],
  };
}

describe('Diplomacy System', () => {
  describe('getDiplomaticStatus', () => {
    it('should return Neutral for same player', () => {
      const world = createTestWorld();
      expect(getDiplomaticStatus(world, 'player-1', 'player-1')).toBe(DiplomaticStatus.Neutral);
    });

    it('should return Neutral when no relationship exists', () => {
      const world = createTestWorld();
      expect(getDiplomaticStatus(world, 'player-1', 'player-2')).toBe(DiplomaticStatus.Neutral);
    });

    it('should return Allied when alliance exists', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        diplomaticRelations: new Map([
          ['player-1-player-2', {
            player1Id: 'player-1',
            player2Id: 'player-2',
            status: DiplomaticStatus.Allied,
            establishedTick: 10,
          }],
        ]),
      };
      
      expect(getDiplomaticStatus(world, 'player-1', 'player-2')).toBe(DiplomaticStatus.Allied);
      expect(getDiplomaticStatus(world, 'player-2', 'player-1')).toBe(DiplomaticStatus.Allied);
    });

    it('should return War when war exists', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        diplomaticRelations: new Map([
          ['player-1-player-2', {
            player1Id: 'player-1',
            player2Id: 'player-2',
            status: DiplomaticStatus.War,
            establishedTick: 20,
          }],
        ]),
      };
      
      expect(getDiplomaticStatus(world, 'player-1', 'player-2')).toBe(DiplomaticStatus.War);
    });
  });

  describe('validateDiplomaticAction', () => {
    it('should reject action with self', () => {
      const world = createTestWorld();
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-1',
        action: DiplomaticAction.OfferAlliance,
        tick: 1,
      };
      
      const result = validateDiplomaticAction(world, request);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('yourself');
    });

    it('should reject alliance offer when already allied', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        diplomaticRelations: new Map([
          ['player-1-player-2', {
            player1Id: 'player-1',
            player2Id: 'player-2',
            status: DiplomaticStatus.Allied,
            establishedTick: 10,
          }],
        ]),
      };
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.OfferAlliance,
        tick: 15,
      };
      
      const result = validateDiplomaticAction(world, request);
      expect(result.valid).toBe(false);
    });

    it('should reject war declaration when at war', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        diplomaticRelations: new Map([
          ['player-1-player-2', {
            player1Id: 'player-1',
            player2Id: 'player-2',
            status: DiplomaticStatus.War,
            establishedTick: 10,
          }],
        ]),
      };
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.DeclareWar,
        tick: 15,
      };
      
      const result = validateDiplomaticAction(world, request);
      expect(result.valid).toBe(false);
    });

    it('should reject war when player has no nodes', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        nodes: {
          ...baseWorld.nodes,
          'node-1': {
            ...baseWorld.nodes['node-1'],
            ownerId: null,
          },
        },
      };
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.DeclareWar,
        tick: 1,
      };
      
      const result = validateDiplomaticAction(world, request);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('must control at least one node');
    });

    it('should reject peace proposal when not at war', () => {
      const world = createTestWorld();
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.ProposePeace,
        tick: 1,
      };
      
      const result = validateDiplomaticAction(world, request);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('war');
    });

    it('should accept valid alliance offer', () => {
      const world = createTestWorld();
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.OfferAlliance,
        tick: 1,
      };
      
      const result = validateDiplomaticAction(world, request);
      expect(result.valid).toBe(true);
    });
  });

  describe('applyDiplomaticAction - Alliance Flow', () => {
    it('should create pending offer for alliance', () => {
      const world = createTestWorld();
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.OfferAlliance,
        tick: 10,
      };
      
      const result = applyDiplomaticAction(world, request);
      
      expect(result.world.pendingOffers).toHaveLength(1);
      expect(result.world.pendingOffers![0]).toEqual({
        fromPlayerId: 'player-1',
        toPlayerId: 'player-2',
        type: 'alliance',
        offeredTick: 10,
      });
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(GameEventType.AllianceOffered);
    });

    it('should form alliance when accepted', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        pendingOffers: [{
          fromPlayerId: 'player-1',
          toPlayerId: 'player-2',
          type: 'alliance',
          offeredTick: 10,
        }],
      };
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-2',
        targetPlayerId: 'player-1',
        action: DiplomaticAction.AcceptAlliance,
        tick: 15,
      };
      
      const result = applyDiplomaticAction(world, request);
      
      expect(result.world.pendingOffers).toHaveLength(0);
      expect(getDiplomaticStatus(result.world, 'player-1', 'player-2')).toBe(DiplomaticStatus.Allied);
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(GameEventType.AllianceFormed);
    });

    it('should remove offer when rejected', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        pendingOffers: [{
          fromPlayerId: 'player-1',
          toPlayerId: 'player-2',
          type: 'alliance',
          offeredTick: 10,
        }],
      };
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-2',
        targetPlayerId: 'player-1',
        action: DiplomaticAction.RejectAlliance,
        tick: 15,
      };
      
      const result = applyDiplomaticAction(world, request);
      
      expect(result.world.pendingOffers).toHaveLength(0);
      expect(getDiplomaticStatus(result.world, 'player-1', 'player-2')).toBe(DiplomaticStatus.Neutral);
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(GameEventType.AllianceRejected);
    });
  });

  describe('applyDiplomaticAction - War Flow', () => {
    it('should declare war immediately', () => {
      const world = createTestWorld();
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.DeclareWar,
        tick: 20,
      };
      
      const result = applyDiplomaticAction(world, request);
      
      expect(getDiplomaticStatus(result.world, 'player-1', 'player-2')).toBe(DiplomaticStatus.War);
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(GameEventType.WarDeclared);
      expect(result.events[0].data.declarerId).toBe('player-1');
      expect(result.events[0].data.targetId).toBe('player-2');
    });

    it('should remove pending offers when war declared', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        pendingOffers: [{
          fromPlayerId: 'player-1',
          toPlayerId: 'player-2',
          type: 'alliance',
          offeredTick: 10,
        }],
      };
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.DeclareWar,
        tick: 20,
      };
      
      const result = applyDiplomaticAction(world, request);
      
      expect(result.world.pendingOffers).toHaveLength(0);
    });
  });

  describe('applyDiplomaticAction - Peace Flow', () => {
    it('should create pending peace proposal', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        diplomaticRelations: new Map([
          ['player-1-player-2', {
            player1Id: 'player-1',
            player2Id: 'player-2',
            status: DiplomaticStatus.War,
            establishedTick: 10,
          }],
        ]),
      };
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.ProposePeace,
        tick: 30,
      };
      
      const result = applyDiplomaticAction(world, request);
      
      expect(result.world.pendingOffers).toHaveLength(1);
      expect(result.world.pendingOffers![0]).toEqual({
        fromPlayerId: 'player-1',
        toPlayerId: 'player-2',
        type: 'peace',
        offeredTick: 30,
      });
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(GameEventType.PeaceProposed);
    });

    it('should return to neutral when peace accepted', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        diplomaticRelations: new Map([
          ['player-1-player-2', {
            player1Id: 'player-1',
            player2Id: 'player-2',
            status: DiplomaticStatus.War,
            establishedTick: 10,
          }],
        ]),
        pendingOffers: [{
          fromPlayerId: 'player-1',
          toPlayerId: 'player-2',
          type: 'peace',
          offeredTick: 30,
        }],
      };
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-2',
        targetPlayerId: 'player-1',
        action: DiplomaticAction.AcceptPeace,
        tick: 35,
      };
      
      const result = applyDiplomaticAction(world, request);
      
      expect(result.world.pendingOffers).toHaveLength(0);
      expect(getDiplomaticStatus(result.world, 'player-1', 'player-2')).toBe(DiplomaticStatus.Neutral);
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(GameEventType.PeaceMade);
    });
  });

  describe('Helper functions', () => {
    it('should get all diplomatic relations', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        diplomaticRelations: new Map([
          ['player-1-player-2', {
            player1Id: 'player-1',
            player2Id: 'player-2',
            status: DiplomaticStatus.Allied,
            establishedTick: 10,
          }],
          ['player-1-player-3', {
            player1Id: 'player-1',
            player2Id: 'player-3',
            status: DiplomaticStatus.War,
            establishedTick: 20,
          }],
        ]),
      };
      
      const relations = getAllDiplomaticRelations(world);
      expect(relations).toHaveLength(2);
    });

    it('should get pending offers for player', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        pendingOffers: [
          {
            fromPlayerId: 'player-1',
            toPlayerId: 'player-2',
            type: 'alliance',
            offeredTick: 10,
          },
          {
            fromPlayerId: 'player-3',
            toPlayerId: 'player-2',
            type: 'peace',
            offeredTick: 15,
          },
          {
            fromPlayerId: 'player-2',
            toPlayerId: 'player-1',
            type: 'alliance',
            offeredTick: 20,
          },
        ],
      };
      
      const offers = getPendingOffersFor(world, 'player-2');
      expect(offers).toHaveLength(2);
      expect(offers.every(o => o.toPlayerId === 'player-2')).toBe(true);
    });

    it('should check if players are allied', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        diplomaticRelations: new Map([
          ['player-1-player-2', {
            player1Id: 'player-1',
            player2Id: 'player-2',
            status: DiplomaticStatus.Allied,
            establishedTick: 10,
          }],
        ]),
      };
      
      expect(areAllied(world, 'player-1', 'player-2')).toBe(true);
      expect(areAllied(world, 'player-1', 'player-3')).toBe(false);
    });

    it('should check if players are at war', () => {
      const baseWorld = createTestWorld();
      const world: GameWorldWithDiplomacy = {
        ...baseWorld,
        diplomaticRelations: new Map([
          ['player-1-player-2', {
            player1Id: 'player-1',
            player2Id: 'player-2',
            status: DiplomaticStatus.War,
            establishedTick: 10,
          }],
        ]),
      };
      
      expect(areAtWar(world, 'player-1', 'player-2')).toBe(true);
      expect(areAtWar(world, 'player-1', 'player-3')).toBe(false);
    });
  });

  describe('Determinism', () => {
    it('should produce same results for same inputs', () => {
      const world1 = createTestWorld();
      const world2 = createTestWorld();
      
      const request: DiplomaticActionRequest = {
        playerId: 'player-1',
        targetPlayerId: 'player-2',
        action: DiplomaticAction.DeclareWar,
        tick: 42,
      };
      
      const result1 = applyDiplomaticAction(world1, request);
      const result2 = applyDiplomaticAction(world2, request);
      
      expect(getDiplomaticStatus(result1.world, 'player-1', 'player-2')).toBe(
        getDiplomaticStatus(result2.world, 'player-1', 'player-2')
      );
      expect(result1.events.length).toBe(result2.events.length);
    });
  });
});
