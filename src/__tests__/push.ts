import * as firebase from '@firebase/testing';
import newDatabase from '../utils/schema';
import syncFireMelon from '../firestoreSync';
import { SyncObj } from '../types/interfaces';
import { Q, Model } from '@nozbe/watermelondb';

const projectId = 'firemelon';

function authedApp() {
    return firebase.initializeAdminApp({ projectId }).firestore();
}

describe('Push Changes function tests', () => {
    beforeEach(async () => {
        await firebase.clearFirestoreData({ projectId });
    });
    afterAll(async () => {
        await Promise.all(firebase.apps().map(app => app.delete()));
    });

    it('should push documents to firestore when adding new objects in watermelonDB', async () => {
        const app1 = authedApp();

        const db = newDatabase();
        const melonTodosRef = db.collections.get('todos');
        const fireTodosRef = app1.collection('todos');
        const melonUsersRef = db.collections.get('users');
        const fireUsersRef = app1.collection('users');

        await db.action(async () => {
            await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });
            await melonUsersRef.create((user: any) => {
                user.text = 'some user name';
            });
        });

        const obj: SyncObj = {
            todos: {},
            users: {},
        };

        await syncFireMelon(db, obj, app1, () => new Date());

        const melonTodos = await melonTodosRef.query().fetch();
        const melonUsers = await melonUsersRef.query().fetch();
        const firstMelonTodo = melonTodos[0]._raw;
        const firstMelonUser = melonUsers[0]._raw;

        const todosSnapshot = await fireTodosRef.get();
        const usersSnapshot = await fireUsersRef.get();
        const firstFireTodo = todosSnapshot.docs[0].data();
        const firstFireUser = usersSnapshot.docs[0].data();

        expect(todosSnapshot.docs.length).toBe(1);
        expect(usersSnapshot.docs.length).toBe(1);

        expect(firstFireTodo.text).toBe(firstMelonTodo.text);
        expect(firstFireUser.name).toBe(firstMelonUser.name);
    });

    it('should update documents in firestore when updating objects in watermelonDB', async () => {
        const app1 = authedApp();

        const db = newDatabase();
        const melonTodosRef = db.collections.get('todos');
        const fireTodosRef = app1.collection('todos');

        const obj: SyncObj = {
            todos: {},
        };

        let updated: Model;

        await db.action(async () => {
            await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });

            updated = await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 2';
            });
        });

        await syncFireMelon(db, obj, app1, () => new Date());

        await db.action(async () => {
            await updated.update((todo: any) => {
                todo.text = 'updated todo';
            });
        });

        await syncFireMelon(db, obj, app1, () => new Date());

        const todosSnapshot = await fireTodosRef.get();

        const firstTodoSnapshot = todosSnapshot.docs.find(t => t.data().text === 'todo 1');
        const updatedTodoSnapshot = todosSnapshot.docs.find(t => t.data().text === 'updated todo');

        expect(firstTodoSnapshot).not.toBeUndefined();
        expect(updatedTodoSnapshot).not.toBeUndefined();

        expect(todosSnapshot.docs.length).toBe(2);
    });

    it('should mark documents in firestore as Deleted when marking objects as deleted in watermelonDB', async () => {
        const app1 = authedApp();

        const db = newDatabase();
        const melonTodosRef = db.collections.get('todos');
        const fireTodosRef = app1.collection('todos');

        const obj: SyncObj = {
            todos: {},
        };

        let deleted: Model;

        await db.action(async () => {
            await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });

            deleted = await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 2';
            });
        });

        await syncFireMelon(db, obj, app1, () => new Date());

        await db.action(async () => {
            await deleted.markAsDeleted();
        });

        await syncFireMelon(db, obj, app1, () => new Date());

        const todosSnapshot = await fireTodosRef.get();

        const firstTodoSnapshot = todosSnapshot.docs.find(t => t.data().text === 'todo 1');
        const deletedTodoSnapshot = todosSnapshot.docs.find(t => t.data().text === 'todo 2');

        expect(firstTodoSnapshot).not.toBeUndefined();
        expect(deletedTodoSnapshot).not.toBeUndefined();

        expect(deletedTodoSnapshot!.data().text).toBe('todo 2');
        expect(deletedTodoSnapshot!.data().isDeleted).toBe(true);

        expect(todosSnapshot.docs.length).toBe(2);
    });
});
