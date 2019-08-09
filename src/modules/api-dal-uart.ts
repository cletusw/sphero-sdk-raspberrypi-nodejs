// external imports
import * as SerialPort from 'serialport';   // https://github.com/node-serialport/node-serialport

// internal imports
import {IApiCommandMessage} from '../models/api-command-message';
import {IApiResponseMessage} from '../models/api-response-message';
import {ApiDalBase, ApiDalTypes, IApiDal} from './api-dal-interface';
import {createLogger, ILogger} from './logger';
import {ApiParserFactory, IApiParser} from './api-parser';
import {IApiMessage} from '../models/api-message';
import {DeferredPromise} from '../models/deferred-promise';
import {ByteConversionUtilities} from '../utilities/byte-conversion-utilities';
import {ApiProtocolErrorCodes} from '../constants';


let logger: ILogger = createLogger('api-dal-uart');


class ApiDalUart extends ApiDalBase {
    private readonly _apiParser: IApiParser;
    private readonly _serialPort: SerialPort;
    private readonly _apiCommandPendingResponseMap: Map<string, DeferredPromise<IApiResponseMessage>>;
    public socketSend: (message: string) => void;

    public get type(): ApiDalTypes {
        return ApiDalTypes.Uart;
    }

    constructor(path: string, baudRate: number) {
        super();

        logger.debug('Starting');

        this._apiParser = ApiParserFactory.getApiParser();

        this._apiParser.apiMessageParsedCallback = (apiMessage: IApiMessage): void => {
            console.log("blahblah");
            this.socketSend("Sent from within DAL!");
            logger.debug(`API Message parsed: ${apiMessage.prettyPrint()}`);

            let mapKey: string = this.getApiMessageMapKey(apiMessage);
            if (!this._apiCommandPendingResponseMap.has(mapKey)) {
                logger.error(`API Message key not found: ${mapKey}`);
                // TODO: do what?
            }

            let responsePromise: DeferredPromise<IApiResponseMessage> | undefined = this._apiCommandPendingResponseMap.get(mapKey);
            if (responsePromise) {
                logger.debug('Promise resolved.');

                this._apiCommandPendingResponseMap.delete(mapKey);
                responsePromise.resolve(apiMessage);

                return;
            }

            logger.warning(`Key size: ${this._apiCommandPendingResponseMap.size}`);
            logger.warning('NO promise found!');

            // TODO: do what?

            // TODO: what about async messages to the socket?

            // if apiMessage is async, then websocket.send(data) , return
            // questions, concerns: in what class does WebSocket object live?
            //                      WebSocket.Server or WebSocket? How does WebSocket.Server fit in with the main server?

        };

        this._apiParser.apiProtocolErrorCallback = (errorCode: number): void => {
            logger.error(`API Protocol Error: '${ApiProtocolErrorCodes.getApiProtocolErrorMessageFromCode(errorCode)}' (${errorCode})`);
        };

        this._serialPort = new SerialPort(path, {
            autoOpen: false,
            baudRate: baudRate
        });

        this._serialPort.on('open', (): void => {
            logger.debug('Serial Port opened');
        });
        this._serialPort.on('close', (): void => {
            logger.debug('Serial Port closed');
        });
        this._serialPort.on('data', (data: Array<number>): void => {
            // var dataUTF8 = data.toString('utf-8');
            console.log(`Received bytes: ${ByteConversionUtilities.convertNumbersToHexCsvString(data)}`);
            logger.debug(`Received bytes: ${ByteConversionUtilities.convertNumbersToHexCsvString(data)}`);

            this._apiParser.queueBytes(data);
        });
        this._serialPort.on('drain', (): void => {
            logger.debug('Serial Port drained');
        });
        this._serialPort.on('error', (error: Error): void => {
            logger.error(`An error occurred on Serial Port: '${error}'`);
        });

        this._apiCommandPendingResponseMap = new Map<string, DeferredPromise<IApiResponseMessage>>();

        this._serialPort.open(error => {
            if (!error) {
                return;
            }

            logger.error(`An error occurred while opening Serial Port: '${error}'`);
        });

        // TODO: do we need these?
        // this._serialPort.close(error => {
        //
        // });
        // this._serialPort.drain(error => {
        //
        // });
    }

    protected async sendApiCommandMessageInternal(apiCommandMessage: IApiCommandMessage): Promise<IApiResponseMessage> {
        logger.debug(`Attempting to send API Command Message: ${apiCommandMessage.prettyPrint()}`);

        let responsePromise: DeferredPromise<IApiResponseMessage> = new DeferredPromise<IApiResponseMessage>();
        let mapKey: string = this.getApiMessageMapKey(apiCommandMessage);

        this._apiCommandPendingResponseMap.set(mapKey, responsePromise);
        logger.warning(`Key size: ${this._apiCommandPendingResponseMap.size}`);

        // TODO: do we need buffer the bytes in case we need to drain?
        console.log(`Bytes being sent: ${ByteConversionUtilities.convertNumbersToHexCsvString(apiCommandMessage.messageRawBytes)}`);
        let isWaitingForDrain: boolean = this._serialPort.write(apiCommandMessage.messageRawBytes, 'utf8', ((error, bytesWritten) => {
            // TODO: do something with this - log?
        }));

        // TODO: do we need to drain manually?

        return responsePromise.promise;
    }

    private getApiMessageMapKey(apiMessage: IApiMessage): string {
        let mapKey: string = `${apiMessage.sequenceNumber}.${apiMessage.deviceId}.${apiMessage.commandId}`;
        //${apiMessage.targetId}.${apiMessage.sourceId}.

        logger.debug(`Generated API Message key: '${mapKey}'`);

        return mapKey;
    }
}

let _uartApiDal: ApiDalUart | null = null;
export function buildUartApiDal(path: string, baudRate: number): IApiDal {
    if (_uartApiDal == null) {
        _uartApiDal = new ApiDalUart(path, baudRate);
    }

    return _uartApiDal;
}
