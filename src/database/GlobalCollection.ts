import * as MongoDb from "mongodb";
import { fortniteBotCore as activeCore } from "../../fortniteBot";
import { DatabaseException } from "../exceptions/DatabaseException";
import { FrotniteBotCollection } from "./FortniteBotCollection";
import { ICollection } from "./ICollection";

export class GlobalCollection extends FrotniteBotCollection implements ICollection {
    private localDb: any;
    private dbId: MongoDb.ObjectId;
    constructor(localDb: MongoDb.Db) {
        super();
        this.localDb = localDb;
        this.dbId = new MongoDb.ObjectId("5b253b8cb43a095ddc7ff9a7");
    }
    public add(id: string, callback: (res: boolean) => void): void {
        this.db.collection("global").updateOne({_id: this.dbId},
            {$push: { targets: id }}, (err) => {
            if (err) {
                callback(false);
                throw new DatabaseException(err);
            }
            callback(true);
        });
    }
    public get(callback: (res: any[]) => void): void {
        this.db.collection("global").find({}).toArray().then((res: any) => {
            callback(res);
        });
    }
    public removeTarget(id: string, callback: (res: boolean) => void): void {
        this.db.collection("global").updateOne({_id: this.dbId},
            {$pull: { targets: id }}, (err) => {
            if (err) {
                callback(false);
                throw new DatabaseException(err);
            }
            callback(true);
        });
    }
}
