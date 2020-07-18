"use strict";

import Entity from './entity.js';
import Item from './item.js';
import { EVENTS } from './events.js';
import io from 'socket.io-client';
import _ from 'underscore';

export default class RogueClient {
    constructor(serverAddr, caller) {
        this.serverAddr = serverAddr;
        this.caller = caller;
        this.entities = {};
        this.others = {};
        this.items = {};
        this.entity = new Entity();
        this.addEntity(this.entity);
        this.socket = null;
    }

    connectToServer(properties) {
        let socket = io(this.serverAddr, {
            'reconnection delay': 0,
            'reopen delay': 0,
            'force new connection': true,
            transports: ['websocket'],
            query: properties,
        });
        this.registerEventHandlers(socket);
        socket.emit(EVENTS.getMap);
        socket.emit(EVENTS.getItems);
        this.socket = socket;
    }

    disconnectFromServer() {
        this.socket.disconnect();
    }

    registerEventHandlers(socket) {
        socket.on(EVENTS.ping, () => {
            this.caller.refresh(EVENTS.ping);
        });

        socket.on(EVENTS.message, (message) => {
            this.caller.refresh(EVENTS.message, message);
        });

        socket.on(EVENTS.delete, (pos) => {
            this.removeEntityAt(pos);
            this.caller.refresh(EVENTS.delete, pos);
        });

        socket.on(EVENTS.map, (map) => {
            this.caller.refresh(EVENTS.map, map);
        });

        socket.on(EVENTS.items,(items) => {
            this.updateItems(items);
            this.caller.refresh(EVENTS.items);
        });

        socket.on(EVENTS.entities, (entities) => {
            this.updateEntities(socket.id, entities);
            this.caller.refresh(EVENTS.entities);
        });

        socket.on(EVENTS.update, (entity) => {
            this.entity.assume(entity);
            this.caller.refresh(EVENTS.update);
        });

        socket.on(EVENTS.dead, (entity) => {
            this.entity.assume(entity);
            this.caller.refresh(EVENTS.dead);
        });

        socket.on(EVENTS.position, (event) => {
            this.updateEntityPosition(event);
            this.caller.refresh(EVENTS.position, event.id);
        });
    }

    sync() {
        this.socket.emit(EVENTS.getItems);
        this.socket.emit(EVENTS.getEntities);
    }

    updateEntityPosition(event) {
        let entity =  (event.id === this.socket.id) ? this.entity : this.others[event.id];
        if (entity) {
            this.moveEntity(entity, event.pos);
        } else {
            this.sync();
        }
    }

    updateEntities(ourId, entities) {
        entities.forEach(entity => {
            if (entity.id !== ourId) {
                this.updateOthers(entity);
            } else {
                this.updateOurself(entity);
            }
        });
    }

    updateOthers(entity) {
        let npc = this.others[entity.id];
        if (npc) {
            npc.assume(entity);
            this.moveEntity(npc, entity.pos);
        } else {
            npc = new Entity(entity);
            this.others[npc.id] = npc;
            this.addEntity(npc);
        }
    }

    updateOurself(entity) {
        this.removeEntity(this.entity);
        this.entity.assume(entity);
        this.addEntity(this.entity);
    }

    updateItems(items) {
        this.items = {};
        for (let pos in items) {
            let here = items[pos];
            here.forEach(item => {
                this.addItem(new Item(item)); 
            });
        }
    }

    hasChangedRoom(message) {
        return (message[0].search('level')>0);
    }

    move(direction) {
        this.socket.emit(EVENTS.move, direction);
    }

    key(x, y, z) {
        return '(' + x + ',' + y + ',' + z + ')';
    }

    posToKey(pos) {
        return this.key(pos.x, pos.y, pos.z);
    }

    addEntity(entity) {
        let key = this.posToKey(entity.pos);
        this.entities[key] = entity;
    }

    getEntityAt(x, y, z) {
        return this.entities[this.key(x, y, z)];
    }

    removeEntity(entity) {
        this.removeEntityAt(entity.pos);
    }

    removeEntityAt(pos) {
        let key = this.posToKey(pos);
        if (this.entities.hasOwnProperty(key)) {
            delete this.entities[key];
        };
    }

    moveEntity(entity, dest) {
        if (_.isEqual(entity.pos, dest)) {
            return;
        }
        this.removeEntity(entity);
        entity.pos = dest;
        this.addEntity(entity);
    }

    getItemsAt(x, y, z) {
        return this.items[this.key(x, y, z)];
    }

    takeItem(item) {
        this.socket.emit(EVENTS.take, item.name);
    }

    dropItem(item) {
        this.socket.emit(EVENTS.drop, item.name);
    }

    eat(item) {
        this.socket.emit(EVENTS.eat, item.name);
    }

    wieldItem(item) {
        let weapon = (item) ? item.name : null;
        this.socket.emit(EVENTS.wield, weapon);
    }

    wearItem(item) {
        let armour = (item) ? item.name : null;
        this.socket.emit(EVENTS.wear, armour);
    }

    addItem(item) {
        let key = this.posToKey(item.pos);
        if (this.items[key]) {
            this.items[key].push(item);
        } else {
            this.items[key] = [item];
        }
    }

    getEntity() {
        return this.entity ;
    }
}