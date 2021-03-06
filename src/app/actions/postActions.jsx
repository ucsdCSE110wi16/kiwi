import firebase, { firebaseRef } from 'app/firebase/';

// - Import utility components
import moment from 'moment';

// - Import action types
import * as types from 'actionTypes';

// - Import actions
import * as globalActions from 'globalActions';

import forge from 'node-forge';

/* _____________ CRUD DB _____________ */

/**
 * Add a normal post
 * @param {object} newPost 
 * @param {function} callBack 
 */
export var dbAddPost = (newPost, callBack) => {
    return (dispatch, getState) => {

        let uid = getState().authorize.uid;
        let post = {
            postTypeId: 0,
            creationDate: moment().unix(),
            deletationDate: '',
            score: 0,
            viewCount: 0,
            body: newPost.body,
            ownerUserId: uid,
            ownerDisplayName: newPost.name,
            ownerAvatar: newPost.avatar,
            lastEditDate: '',
            tags: newPost.tags || [],
            commentCounter: 0,
            image: '',
            video: '',
            disableComments: newPost.disableComments,
            disableSharing: newPost.disableSharing,
            deleted: false
        };

        // deep copy
        let encryptedPost = JSON.parse(JSON.stringify(post));

        // Get own public key
        let key = localStorage.getItem('PUBkey');
        let iv = localStorage.getItem('PUBiv');
        let privateKey, publicKey;
    
        // encrypt some bytes using GCM mode
        let cipher = forge.cipher.createCipher('AES-CBC', key);
        cipher.start({iv: iv});
        cipher.update(forge.util.createBuffer(post.body));
        cipher.finish();
        encryptedPost.body = forge.util.encode64(cipher.output.getBytes());

        let postRef = firebaseRef.child(`userPosts/${uid}/posts`).push(encryptedPost);
        return postRef.then(() => {
            dispatch(addPost(uid, {
                ...post,
                id: postRef.key
            }));
            callBack();
        }, (error) => dispatch(globalActions.showErrorMessage(error.message)));
    };
}


/**
 * Add a post with image
 * @param {object} newPost 
 * @param {function} callBack 
 */
export const dbAddImagePost = (newPost, callBack) => {
    return (dispatch, getState) => {
        dispatch(globalActions.showTopLoading());
        
        let uid = getState().authorize.uid;
        let post = {
            postTypeId: 1,
            creationDate: moment().unix(),
            deletationDate: '',
            score: 0,
            viewCount: 0,
            body: newPost.body,
            ownerUserId: uid,
            ownerDisplayName: newPost.name,
            ownerAvatar: newPost.avatar,
            lastEditDate: '',
            tags: newPost.tags || [],
            commentCounter: 0,
            image: newPost.image || '',
            imageFullPath: newPost.imageFullPath || '',
            video: '',
            disableComments: newPost.disableComments ? newPost.disableComments : false,
            disableSharing: newPost.disableSharing ? newPost.disableSharing : false,
            deleted: false
        };

        // deep copy
        let encryptedPost = JSON.parse(JSON.stringify(post));

        // Get own public key
        let key = localStorage.getItem('PUBkey');
        let iv = localStorage.getItem('PUBiv');
        let privateKey, publicKey;
    
        // encrypt some bytes using GCM mode
        let cipher = forge.cipher.createCipher('AES-CBC', key);
        cipher.start({iv: iv});
        cipher.update(forge.util.createBuffer(post.body));
        cipher.finish();
        encryptedPost.body = forge.util.encode64(cipher.output.getBytes());

        // TODO: Encrypt images
        let postRef = firebaseRef.child(`userPosts/${uid}/posts`).push(encryptedPost);
        return postRef.then(() => {
            dispatch(addPost(uid, {
                ...post,
                id: postRef.key       
            }));
            callBack();
            dispatch(globalActions.hideTopLoading());
        });
    };
}

/**
 * Update a post from database
 * @param  {object} newPost 
 * @param {func} callBack //TODO: anti pattern should change to parent state or move state to redux
 */
export const dbUpdatePost = (newPost, callBack) => {
    // console.log(newPost);
    return (dispatch, getState) => {
        dispatch(globalActions.showTopLoading());

        // Get current user id
        let uid = getState().authorize.uid;

        // Write the new data simultaneously in the list
        let updates = {};
        let post = getState().post.userPosts[uid][newPost.id];
        let updatedPost = {
            postTypeId: post.postTypeId,
            creationDate: post.creationDate,
            deletationDate: '',
            score: post.score,
            viewCount: post.viewCount,
            body: newPost.body ? newPost.body : post.body || '',
            ownerUserId: uid,
            ownerDisplayName: post.ownerDisplayName,
            ownerAvatar: post.ownerAvatar,
            lastEditDate: moment().unix(),
            tags: newPost.tags ? newPost.tags : (post.tags || []),
            commentCounter: post.commentCounter,
            image: newPost.image ? newPost.image : post.image,
            video: '',
            disableComments: newPost.disableComments !== undefined ? newPost.disableComments : (post.disableComments ? post.disableComments : false),
            disableSharing: newPost.disableSharing !== undefined ? newPost.disableSharing : (post.disableSharing ? post.disableSharing : false),
            deleted: false
        };

        updates[`userPosts/${uid}/posts/${newPost.id}`] = updatedPost;

        return firebaseRef.update(updates).then((result) => {
            dispatch(updatePost(uid, { id: newPost.id, ...updatedPost }));
            callBack();
            dispatch(globalActions.hideTopLoading());
        }, (error) => {
            dispatch(globalActions.showErrorMessage(error.message));
            dispatch(globalActions.hideTopLoading());
        });
    };
}

/**
 * Delete a post from database
 * @param  {string} id is post identifier
 */
export const dbDeletePost = (id) => {
    return (dispatch, getState) => {
        dispatch(globalActions.showTopLoading());

        // Get current user id
        let uid = getState().authorize.uid;

        // Write the new data simultaneously in the list
        let updates = {};
        updates[`userPosts/${uid}/posts/${id}`] = null;

        return firebaseRef.update(updates).then((result) => {
            dispatch(deletePost(uid, id));
            dispatch(globalActions.hideTopLoading());
        }, (error) => {
            dispatch(globalActions.showErrorMessage(error.message));
            dispatch(globalActions.hideTopLoading());
        });
    };
}

//  Get all user posts from data base (self posts)
export const dbGetPosts = () => {
    return (dispatch, getState) => {
        // Look up key and iv to decipher post
        let key, iv, decipher;
        let uid = getState().authorize.uid;
        let keysRef = firebaseRef.child(`keys/${uid}`);
        keysRef.once('value').then((snap) => {
            if(snap.val()) {
                key = snap.val().key || {};
                iv = snap.val().iv || {};
                decipher = forge.cipher.createDecipher('AES-CBC', key);
            }
            if (uid) {
                let postsRef = firebaseRef.child(`userPosts/${uid}/posts`);
                
                // Decrypt body of post look up all of own's posts
                return postsRef.once('value').then((snapshot) => {
                    let posts = snapshot.val() || {};
                    let parsedPosts = {};
                    Object.keys(posts).forEach((postId) => {
                        parsedPosts[postId] = {
                            id: postId,
                            ...posts[postId]
                        };
                        // Decrypt body of post
                        if(snap.val()) {
                            decipher.start({iv: iv});
                            decipher.update(forge.util.createBuffer(forge.util.decode64(parsedPosts[postId].body)));
                            decipher.finish();
                            let decipheredText = decipher.output.toString();
                            parsedPosts[postId].body = decipheredText
                        }
                    });
                    
                    dispatch(addPosts(uid, parsedPosts));
                });
            }
        });
    };
}

//  Get all user posts from data base
export const dbGetPostById = (uid, postId) => {

    return (dispatch, getState) => {
        // Look up key and iv to decipher post
        let key, iv, decipher;
        let keysRef = firebaseRef.child(`keys/${uid}`);
        keysRef.once('value').then((snap) => {
            if(snap.val()) {
                key = snap.val().key || {};
                iv = snap.val().iv || {};
                decipher = forge.cipher.createDecipher('AES-CBC', key);
            }
            if (uid) {
                let postsRef = firebaseRef.child(`userPosts/${uid}/posts/${postId}`);

                return postsRef.once('value').then((snapshot) => {
                    const newPost = snapshot.val() || {};
                    const post = {
                        id: postId,
                        ...newPost
                    };
                    // Decrypt body of post
                    if(snap.val()) {
                        decipher.start({iv: iv});
                        decipher.update(forge.util.createBuffer(forge.util.decode64(post.body)));
                        decipher.finish();
                        let decipheredText = decipher.output.toString();
                        post.body = decipheredText
                    }
                    dispatch(addPost(uid, post));
                });
            }
        });
    };
}

/**
 * Get all user post from database by user id
 * @param  {string} uid is id of user whose posts we want to get
 */
export const dbGetPostsByUserId = (uid) => {
    return (dispatch, getState) => {
        // Look up key and iv to decipher post
        let key, iv, decipher;
        let keysRef = firebaseRef.child(`keys/${uid}`);
        keysRef.once('value').then((snap) => {
            if(snap.val()) {
                key = snap.val().key || {};
                iv = snap.val().iv || {};
                decipher = forge.cipher.createDecipher('AES-CBC', key);
            }

            if (uid) {
                let postsRef = firebaseRef.child(`userPosts/${uid}/posts`);
    
                // Look up all posts of user with this id
                return postsRef.once('value').then((snapshot) => {
                    let posts = snapshot.val() || {};
                    let parsedPosts = {};
                    Object.keys(posts).forEach((postId) => {
                        parsedPosts[postId] = {
                            id: postId,
                            ...posts[postId]
                        };
                        // Decrypt body of post
                        if(snap.val()) {
                            decipher.start({iv: iv});
                            decipher.update(forge.util.createBuffer(forge.util.decode64(parsedPosts[postId].body)));
                            decipher.finish();
                            let decipheredText = decipher.output.toString();
                            parsedPosts[postId].body = decipheredText
                        }
                    });
                
                    dispatch(addPosts(uid, parsedPosts));
                });
            }
        });
    };
}

/* _____________ CRUD State _____________ */

/**
 * Add a normal post
 * @param {string} uid is user identifier
 * @param {object} post 
 */
export const addPost = (uid, post) => {
    return {
        type: types.ADD_POST,
        payload: { uid, post }
    };
}

/**
 * Update a post
 * @param {string} uid is user identifier
 * @param {object} post 
 */
export const updatePost = (uid, post) => {
    return {
        type: types.UPDATE_POST,
        payload: { uid, post }
    };
}

/**
 * Delete a post
 * @param {string} uid is user identifier
 * @param {string} id is post identifier
 */
export const deletePost = (uid, id) => {
    return {
        type: types.DELETE_POST,
        payload: { uid, id }
    };
}


/**
 * Add a list of post
 * @param {string} uid 
 * @param {[object]} posts 
 */
export const addPosts = (uid, posts) => {
    return {
        type: types.ADD_LIST_POST,
        payload: { uid, posts }
    };
}

/**
 * Clea all data in post store
 */
export const clearAllData = () => {
    return {
        type: types.CLEAR_ALL_DATA_POST
    };
}

/**
 * Add a post with image
 * @param {object} post 
 */
export const addImagePost = (uid, post) => {
    return {
        type: types.ADD_IMAGE_POST,
        payload: { uid, post }
    };
}