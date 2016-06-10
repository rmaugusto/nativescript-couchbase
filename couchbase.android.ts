import applicationModule = require("application");
//import fs = require("file-system");

declare var com: any;
declare var java: any;
declare var android: any;

export class Couchbase {

    private context: any;
    private manager: any;
    private database: any;

    constructor(databaseName: string) {
        this.context = applicationModule.android.context;
        try {
            this.manager = new com.couchbase.lite.Manager(new com.couchbase.lite.android.AndroidContext(this.context), null);
            this.database = this.manager.getDatabase(databaseName);
        } catch (exception) {
            console.error("MANAGER ERROR:", exception.message);
        }
    }

    createDocument(data: Object) {
        var document: any = this.database.createDocument();
        var documentId: string = document.getId();
        try {
            document.putProperties(this.objectToMap(data));
        } catch (exception) {
            console.error("DOCUMENT ERROR:", exception.message);
        }
        return documentId;
    }

    getDocument(documentId: string) {
        var document: any = this.database.getDocument(documentId);
        return JSON.parse(this.mapToJson(document.getProperties()));
    }

    updateDocument(documentId: string, data: Object) {
        var document: any = this.database.getDocument(documentId);
        try {
            document.putProperties(this.objectToMap(data));
        } catch (exception) {
            console.error("DOCUMENT ERROR", exception.message);
        }
    }

    deleteDocument(documentId: string) {
        var document: any = this.database.getDocument(documentId);
        try {
            document.delete();
        } catch (exception) {
            console.error("DOCUMENT ERROR", exception.message);
        }
        return document.isDeleted();
    }

    destroyDatabase() {
        try {
            this.database.delete();
        } catch (exception) {
            console.error("DESTROY", exception.message);
        }
    }

    createView(viewName: string, viewRevision: string, callback: any) {
        var view = this.database.getView(viewName);
        var self = this;
        view.setMap(new com.couchbase.lite.Mapper({
            map(document, emitter) {
                let e = new Emitter(emitter);
                callback(JSON.parse(self.mapToJson(document)), e);
            }
        }), viewRevision);
    }

    executeQuery(viewName: string) {
        var query = this.database.getView(viewName).createQuery();
        var result = query.run();
        var parsedResult: Array<any> = [];
        while(result.hasNext()) {
            var row = result.next();
            parsedResult.push(this.mapToObject(row.getValue()));
        }
        return parsedResult;
    }

    createPullReplication(remoteUrl: string) {
        var replication;
        try {
            replication = this.database.createPullReplication(new java.net.URL(remoteUrl));
        } catch (exception) {
            console.error("PULL ERROR", exception.message);
        }
        return new Replicator(replication);
    }

    createPushReplication(remoteUrl: string) {
        var replication;
        try {
            replication = this.database.createPushReplication(new java.net.URL(remoteUrl));
        } catch (exception) {
            console.error("PUSH ERROR", exception.message);
        }
        return new Replicator(replication);
    }

    addDatabaseChangeListener(callback: any) {
        try {
            var self = this;
            this.database.addChangeListener(new com.couchbase.lite.Database.ChangeListener({
                changed(event) {
                    let changes: Array<any> = event.getChanges().toArray();
                    callback(changes);
                }
            }));
        } catch (exception) {
            console.error("DATABASE LISTENER ERROR", exception.message);
        }
    }

    private objectToMap(data: Object) {
        var gson = (new com.google.gson.GsonBuilder()).create();
        return gson.fromJson(JSON.stringify(data), (new java.util.HashMap).getClass());
    }

    private mapToJson(data: Object) {
        var gson = (new com.google.gson.GsonBuilder()).create();
        return gson.toJson(data);
    }

    private mapToObject(data: Object) {
        var gson = (new com.google.gson.GsonBuilder()).create();
        return JSON.parse(gson.toJson(data));
    }

    /*private getPath(uri) {
        let cursor = applicationModule.android.currentContext.getContentResolver().query(uri, null, null, null, null);
        if (cursor == null) return null;
        let column_index = cursor.getColumnIndexOrThrow(android.provider.MediaStore.MediaColumns.DATA);
        cursor.moveToFirst();
        let s = cursor.getString(column_index);
        cursor.close();
        return s;
    }

    getAttachment(documentId: string, attachmentId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let document = this.database.getDocument(documentId);
            let rev = document.getCurrentRevision();
            let att = rev.getAttachment(attachmentId);
            if (att != null) {
                resolve(att.getContent());
            } else {
                reject("Sorry can't process your request");
            }
        })
    }

    setAttachment(documentId: string, attachmentId: string, file: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let document = this.database.getDocument(documentId);
            let newRev = document.getCurrentRevision().createRevision();
            if (file.toString().substr(0, 10).indexOf('content://') > -1) {
                let stream = applicationModule.android.context.getContentResolver().openInputStream(file);
                let fileExtension = android.webkit.MimeTypeMap.getFileExtensionFromUrl(this.getPath(file));
                let mimeType = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(fileExtension);
                try {
                    newRev.setAttachment(attachmentId, mimeType, stream);
                    newRev.save();
                    resolve();
                } catch (exception) {
                    reject(exception.message);
                }

            } else if (file.toString().substr(0, 7).indexOf('file://') > -1) {
                let stream = applicationModule.android.context.getContentResolver().openInputStream(android.net.Uri.fromFile(file));
                let fileExtension = android.webkit.MimeTypeMap.getFileExtensionFromUrl(file);
                let mimeType = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(fileExtension);
                try {
                    newRev.setAttachment(attachmentId, mimeType, stream);
                    newRev.save();
                    resolve();
                } catch (exception) {
                    reject(exception.message);
                }
            } else if (file.substr(0, 2).indexOf('~/') > -1) {
                let path = fs.path.join(fs.knownFolders.currentApp().path, file.replace('~/', ''));
                let stream = applicationModule.android.context.getContentResolver().openInputStream(android.net.Uri.fromFile(new java.io.File(path)));
                let fileExtension = android.webkit.MimeTypeMap.getFileExtensionFromUrl(path);
                let mimeType = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(fileExtension);
                try {
                    newRev.setAttachment(attachmentId, mimeType, stream);
                    newRev.save();
                    resolve();
                } catch (exception) {
                    reject(exception.message);
                }
            }
        })
    }

    removeAttachment(documentId: string, attachmentId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let document = this.database.getDocument(documentId);
            let newRev = document.getCurrentRevision().createRevision();
            try {
                newRev.removeAttachment(attachmentId);
                newRev.save();
                resolve();
            } catch (exception) {
                reject(exception.message);
            }

        })
    }*/

}

export class Replicator {

    replicator: any;

    constructor(replicator: any) {
        this.replicator = replicator;
    }

    start() {
        this.replicator.start();
    }

    stop() {
        this.replicator.stop();
    }

    isRunning() {
        return this.replicator.isRunning;
    }

    setContinuous(isContinuous: boolean) {
        this.replicator.setContinuous(isContinuous);
    }

}

export class Emitter {

    public emitter: any;

    constructor(emitter: any) {
        this.emitter = emitter;
    }

    emit(key: Object, value: Object) {
        if(typeof value === "object") {
            var gson = (new com.google.gson.GsonBuilder()).create();
            this.emitter.emit(key, gson.fromJson(JSON.stringify(value), (new java.util.HashMap).getClass()));
        } else {
            this.emitter.emit(key, value);
        }
    }

}
