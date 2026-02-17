/**
 * Diplomacy System - Player relationship mechanics.
 * 
 * Design principles:
 * - Pure functions: no mutations, no side effects
 * - Deterministic: same inputs always produce same outputs
 * - Server-authoritative: actions processed during tick
 * 
 * Relationship mechanics:
 * - Alliance offers require acceptance (pending state)
 * - War declarations are unilateral (immediate)
 * - Peace proposals require acceptance from target
 * - Only 2-player relationships (no multi-party alliances)
 */

import type {
  GameWorld,
  EntityId,
  Tick,
  GameEvent,
  GameEventType,
} from '../types';

/** Diplomatic status between two players */
export enum DiplomaticStatus {
  Neutral = 'neutral',
  Allied = 'allied',
  War = 'war',
}

/** Diplomatic actions that can be initiated */
export enum DiplomaticAction {
  OfferAlliance = 'offer_alliance',
  AcceptAlliance = 'accept_alliance',
  RejectAlliance = 'reject_alliance',
  DeclareWar = 'declare_war',
  ProposePeace = 'propose_peace',
  AcceptPeace = 'accept_peace',
}

/** A diplomatic relationship between two players */
export interface DiplomaticRelation {
  readonly player1Id: string;
  readonly player2Id: string;
  readonly status: DiplomaticStatus;
  readonly establishedTick: number;
}

/** A pending diplomatic offer */
export interface PendingOffer {
  readonly fromPlayerId: string;
  readonly toPlayerId: string;
  readonly type: 'alliance' | 'peace';
  readonly offeredTick: number;
}

/** Extended GameWorld with diplomacy data */
export interface GameWorldWithDiplomacy extends GameWorld {
  readonly diplomaticRelations?: ReadonlyMap<string, DiplomaticRelation>;
  readonly pendingOffers?: readonly PendingOffer[];
}

/** Result of diplomacy processing */
export interface DiplomacyProcessResult {
  readonly world: GameWorldWithDiplomacy;
  readonly events: GameEvent[];
}

/** Action request for diplomatic state change */
export interface DiplomaticActionRequest {
  readonly playerId: string;
  readonly targetPlayerId: string;
  readonly action: DiplomaticAction;
  readonly tick: number;
}

/**
 * Generate a consistent key for a player pair.
 * Always orders player IDs alphabetically to ensure consistency.
 */
function getRelationKey(player1Id: string, player2Id: string): string {
  return player1Id < player2Id 
    ? `${player1Id}-${player2Id}` 
    : `${player2Id}-${player1Id}`;
}

/**
 * Get diplomatic status between two players.
 * Returns Neutral if no relationship exists.
 */
export function getDiplomaticStatus(
  world: GameWorldWithDiplomacy,
  player1Id: string,
  player2Id: string
): DiplomaticStatus {
  if (player1Id === player2Id) {
    return DiplomaticStatus.Neutral;
  }

  const relations = world.diplomaticRelations || new Map();
  const key = getRelationKey(player1Id, player2Id);
  const relation = relations.get(key);

  return relation ? relation.status : DiplomaticStatus.Neutral;
}

/**
 * Check if a player has any claimed nodes.
 */
function hasClaimedNodes(world: GameWorld, playerId: string): boolean {
  return Object.values(world.nodes).some(node => node.ownerId === playerId);
}

/**
 * Find a pending offer matching criteria.
 */
function findPendingOffer(
  offers: readonly PendingOffer[],
  fromPlayerId: string,
  toPlayerId: string,
  type: 'alliance' | 'peace'
): PendingOffer | undefined {
  return offers.find(
    offer =>
      offer.fromPlayerId === fromPlayerId &&
      offer.toPlayerId === toPlayerId &&
      offer.type === type
  );
}

/**
 * Validate a diplomatic action request.
 * Returns { valid: true } if valid, { valid: false, reason } if invalid.
 */
export function validateDiplomaticAction(
  world: GameWorldWithDiplomacy,
  request: DiplomaticActionRequest
): { valid: boolean; reason?: string } {
  const { playerId, targetPlayerId, action } = request;

  // Can't act on yourself
  if (playerId === targetPlayerId) {
    return { valid: false, reason: 'Cannot perform diplomatic action with yourself' };
  }

  const currentStatus = getDiplomaticStatus(world, playerId, targetPlayerId);
  const offers = world.pendingOffers || [];

  switch (action) {
    case DiplomaticAction.OfferAlliance:
      if (currentStatus === DiplomaticStatus.Allied) {
        return { valid: false, reason: 'Already allied with this player' };
      }
      if (currentStatus === DiplomaticStatus.War) {
        return { valid: false, reason: 'Cannot offer alliance while at war' };
      }
      if (findPendingOffer(offers, playerId, targetPlayerId, 'alliance')) {
        return { valid: false, reason: 'Alliance offer already pending' };
      }
      break;

    case DiplomaticAction.AcceptAlliance:
      if (!findPendingOffer(offers, targetPlayerId, playerId, 'alliance')) {
        return { valid: false, reason: 'No pending alliance offer from this player' };
      }
      break;

    case DiplomaticAction.RejectAlliance:
      if (!findPendingOffer(offers, targetPlayerId, playerId, 'alliance')) {
        return { valid: false, reason: 'No pending alliance offer from this player' };
      }
      break;

    case DiplomaticAction.DeclareWar:
      if (currentStatus === DiplomaticStatus.War) {
        return { valid: false, reason: 'Already at war with this player' };
      }
      if (!hasClaimedNodes(world, playerId)) {
        return { valid: false, reason: 'You must control at least one node to declare war' };
      }
      if (!hasClaimedNodes(world, targetPlayerId)) {
        return { valid: false, reason: 'Target player must control at least one node' };
      }
      break;

    case DiplomaticAction.ProposePeace:
      if (currentStatus !== DiplomaticStatus.War) {
        return { valid: false, reason: 'Can only propose peace during war' };
      }
      if (findPendingOffer(offers, playerId, targetPlayerId, 'peace')) {
        return { valid: false, reason: 'Peace proposal already pending' };
      }
      break;

    case DiplomaticAction.AcceptPeace:
      if (!findPendingOffer(offers, targetPlayerId, playerId, 'peace')) {
        return { valid: false, reason: 'No pending peace proposal from this player' };
      }
      break;

    default:
      return { valid: false, reason: 'Unknown diplomatic action' };
  }

  return { valid: true };
}

/**
 * Apply a diplomatic action to the game world.
 * Returns updated world and generated events.
 */
export function applyDiplomaticAction(
  world: GameWorldWithDiplomacy,
  request: DiplomaticActionRequest
): DiplomacyProcessResult {
  const events: GameEvent[] = [];
  
  // Validate action
  const validation = validateDiplomaticAction(world, request);
  if (!validation.valid) {
    return { world, events };
  }

  const { playerId, targetPlayerId, action, tick } = request;
  
  // Clone mutable structures
  const relations = new Map(world.diplomaticRelations || new Map());
  let offers = [...(world.pendingOffers || [])];
  
  const relationKey = getRelationKey(playerId, targetPlayerId);

  switch (action) {
    case DiplomaticAction.OfferAlliance: {
      offers.push({
        fromPlayerId: playerId,
        toPlayerId: targetPlayerId,
        type: 'alliance',
        offeredTick: tick,
      });
      
      events.push({
        type: 'alliance_offered' as GameEventType,
        tick,
        entityId: playerId,
        data: {
          fromPlayerId: playerId,
          toPlayerId: targetPlayerId,
        },
      });
      break;
    }

    case DiplomaticAction.AcceptAlliance: {
      offers = offers.filter(
        offer => !(
          offer.fromPlayerId === targetPlayerId &&
          offer.toPlayerId === playerId &&
          offer.type === 'alliance'
        )
      );

      relations.set(relationKey, {
        player1Id: playerId < targetPlayerId ? playerId : targetPlayerId,
        player2Id: playerId < targetPlayerId ? targetPlayerId : playerId,
        status: DiplomaticStatus.Allied,
        establishedTick: tick,
      });

      events.push({
        type: 'alliance_formed' as GameEventType,
        tick,
        entityId: playerId,
        data: {
          player1Id: playerId,
          player2Id: targetPlayerId,
        },
      });
      break;
    }

    case DiplomaticAction.RejectAlliance: {
      offers = offers.filter(
        offer => !(
          offer.fromPlayerId === targetPlayerId &&
          offer.toPlayerId === playerId &&
          offer.type === 'alliance'
        )
      );

      events.push({
        type: 'alliance_rejected' as GameEventType,
        tick,
        entityId: playerId,
        data: {
          fromPlayerId: targetPlayerId,
          toPlayerId: playerId,
        },
      });
      break;
    }

    case DiplomaticAction.DeclareWar: {
      relations.set(relationKey, {
        player1Id: playerId < targetPlayerId ? playerId : targetPlayerId,
        player2Id: playerId < targetPlayerId ? targetPlayerId : playerId,
        status: DiplomaticStatus.War,
        establishedTick: tick,
      });

      offers = offers.filter(
        offer => !(
          (offer.fromPlayerId === playerId && offer.toPlayerId === targetPlayerId) ||
          (offer.fromPlayerId === targetPlayerId && offer.toPlayerId === playerId)
        )
      );

      events.push({
        type: 'war_declared' as GameEventType,
        tick,
        entityId: playerId,
        data: {
          declarerId: playerId,
          targetId: targetPlayerId,
        },
      });
      break;
    }

    case DiplomaticAction.ProposePeace: {
      offers.push({
        fromPlayerId: playerId,
        toPlayerId: targetPlayerId,
        type: 'peace',
        offeredTick: tick,
      });

      events.push({
        type: 'peace_proposed' as GameEventType,
        tick,
        entityId: playerId,
        data: {
          fromPlayerId: playerId,
          toPlayerId: targetPlayerId,
        },
      });
      break;
    }

    case DiplomaticAction.AcceptPeace: {
      offers = offers.filter(
        offer => !(
          offer.fromPlayerId === targetPlayerId &&
          offer.toPlayerId === playerId &&
          offer.type === 'peace'
        )
      );

      relations.set(relationKey, {
        player1Id: playerId < targetPlayerId ? playerId : targetPlayerId,
        player2Id: playerId < targetPlayerId ? targetPlayerId : playerId,
        status: DiplomaticStatus.Neutral,
        establishedTick: tick,
      });

      events.push({
        type: 'peace_made' as GameEventType,
        tick,
        entityId: playerId,
        data: {
          player1Id: playerId,
          player2Id: targetPlayerId,
        },
      });
      break;
    }
  }

  return {
    world: {
      ...world,
      diplomaticRelations: relations,
      pendingOffers: offers,
    },
    events,
  };
}

/**
 * Get all diplomatic relations in the world.
 */
export function getAllDiplomaticRelations(
  world: GameWorldWithDiplomacy
): DiplomaticRelation[] {
  const relations = world.diplomaticRelations || new Map();
  return Array.from(relations.values());
}

/**
 * Get all pending offers for a specific player (as recipient).
 */
export function getPendingOffersFor(
  world: GameWorldWithDiplomacy,
  playerId: string
): PendingOffer[] {
  const offers = world.pendingOffers || [];
  return offers.filter(offer => offer.toPlayerId === playerId);
}

/**
 * Check if two players are allied.
 */
export function areAllied(
  world: GameWorldWithDiplomacy,
  player1Id: string,
  player2Id: string
): boolean {
  return getDiplomaticStatus(world, player1Id, player2Id) === DiplomaticStatus.Allied;
}

/**
 * Check if two players are at war.
 */
export function areAtWar(
  world: GameWorldWithDiplomacy,
  player1Id: string,
  player2Id: string
): boolean {
  return getDiplomaticStatus(world, player1Id, player2Id) === DiplomaticStatus.War;
}
