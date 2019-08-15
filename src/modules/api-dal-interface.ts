// internal imports
import {IApiMessageLight} from '../models/api-message'

import {IApiCommandMessage} from '../models/api-command-message'
import {IApiResponseMessage} from '../models/api-response-message'


export enum ApiDalTypes {
    Uart,
    Mock
}

export interface IApiMessageNotificationObserver {
    apiCommandMessageReceivedNotification(apiCommandMessage: IApiCommandMessage): void; // TODO: eventually this needs to return an IApiResponseMessage
}

export interface IApiDal {
    readonly type: ApiDalTypes;

    sendApiCommandMessage(apiCommandMessage: IApiCommandMessage): Promise<IApiResponseMessage>;

    registerApiMessageNotificationObserver(apiMessageNotificationObserver: IApiMessageNotificationObserver): void;

    commandToClientHandler: (message: IApiMessageLight) => void;

    getAsyncMessageParser: (deviceId: number, commandId: number) => any;
}

export abstract class ApiDalBase implements IApiDal {
    private readonly _apiMessageNotificationObservers: Array<IApiMessageNotificationObserver> = [];

    public abstract get type(): ApiDalTypes;

    protected constructor() {
        // do nothing...
    }

    public async sendApiCommandMessage(apiMessage: IApiCommandMessage): Promise<IApiResponseMessage> {
        return await this.sendApiCommandMessageInternal(apiMessage);
    }

    protected abstract sendApiCommandMessageInternal(apiCommandMessage: IApiCommandMessage): Promise<IApiResponseMessage>;

    public registerApiMessageNotificationObserver(apiMessageNotificationObserver: IApiMessageNotificationObserver): void {
        this._apiMessageNotificationObservers.push(apiMessageNotificationObserver);
    }

    protected invokeReceivedApiCommandMessageCallback(apiCommandMessage: IApiCommandMessage): void {
        for (let i = 0; i < this._apiMessageNotificationObservers.length; i++) {
            this._apiMessageNotificationObservers[i].apiCommandMessageReceivedNotification(apiCommandMessage);
        }
    }

    public commandToClientHandler: (message: IApiMessageLight) => void;

    public getAsyncMessageParser: (deviceId: number, commandId: number) => any;

}
