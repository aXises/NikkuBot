import Command from "command/AbstractCommand";
import DBUserSchema from "database/schemas/DBUserSchema";
import PrefixManager from "managers/PrefixManager";
import CommandRegistry from "../registries/CommandRegistry";
import TriggerableCommand from "../command/TriggerableCommand";
import OnMessageState from "state/OnMessageState";
import ExecutableCommand from "../command/ExecutableCommand";
import NikkuException from "exception/NikkuException";
import { AccessLevel } from "user/AccessLevel";
import DynamicImportManager from "./DynamicImportManager";
import { Config } from "config/Config";

export default class CommandManager extends DynamicImportManager {

    private prefixManager: PrefixManager;

    private commandRegistry: CommandRegistry;

    /**
     * @classdesc Class to handle import and execution of commands.
     */
    public constructor() {
        super(Config.Command.DIR_PATH, Config.Command.MODULE_PATHS);
        this.prefixManager = new PrefixManager();
        this.commandRegistry = new CommandRegistry();
    }

    public async loadCommands(): Promise<void> {
        const importPaths: string[] = this.getImportPaths();
        this.logger.info(`Detected ${importPaths.length}` +
                ` ${importPaths.length === 1 ? "command" : "commands"} for import.`);
        for (const path of importPaths) {
            const commandClass = await import(`${this.DIR_PATH}/${path}`);
            if (!commandClass.default) {
                this.logger.warn(`Fail to register command. "${this.DIR_PATH}/${path}" has no default export.`);
            } else if (!(new commandClass.default() instanceof Command)) {
                this.logger.warn(`Fail to register command. "${this.DIR_PATH}/${path}" exported class is not of type "Command".`);
            } else {
                this.commandRegistry.addCommand(new commandClass.default());
            }
        }
        this.logger.info(`Successfully imported ${this.commandRegistry.getRegistrySize()} ` +
                `out of ${importPaths.length} ${importPaths.length === 1 ? "command" : "commands"}.`);
    }

    /**
     * Listens for channel messages and attempts to run a command by invoking its action or trigger.
     * @param line - The channel message to evaluate.
     * @param id - The discord id of the user invoking the command.
     */
    public parseLine(line: string, id: string, msg: OnMessageState): void {
        for (const prefix of this.prefixManager.getPrefixes()) {
            if (line.split(" ")[0] === prefix) {
                const commandString = this.extractCommand(line);
                if (!commandString) {
                    return;
                }
                const command: Command = this.commandRegistry.getElementByKey(commandString);
                if (command) {
                    this.attemptExecution(command, this.extractArguments(line, command.getArgLength()), id, msg).catch((err) => {
                        this.logger.verbose(
                            `${err.constructor.name}:Execution of "${command.getCommandString()}" failed`,
                        );
                    });
                }
                return;
            }
        }
        this.triggerAction(id, msg);
    }

    private async attemptExecution(command: Command, args: string[], userId: string, msg: OnMessageState): Promise<void> {
        if (!this.core.getDbCore().isReady()) {
            this.logger.warn("Please wait until database connection has resolved.");
            return;
        }
        if (command.getArgLength() !== 0 && args.length !== command.getArgLength()) {
            if (command instanceof ExecutableCommand) {
                command.displayUsageText(msg);
                throw new NikkuException("Invalid arguments.");
            }
        }
        command.setArgs(args);
        const user = await DBUserSchema.getUserById(userId);
        if (user && msg.getHandle().member.hasPermission("ADMINISTRATOR") && user.accessLevel < AccessLevel.ADMINISTRATOR
                && user.accessLevel !== AccessLevel.DEVELOPER) {
            await user.setAccessLevel(AccessLevel.ADMINISTRATOR);
            msg.getHandle().reply("You are a server administrator. Your access level has been to set to **ADMINISTRATOR**.");
        }
        if (user) {
            this.logger.info(`Executing command "${command.getCommandString()}".`);
            try {
                await command.executeAction(msg, user);
            } catch (err) {
                throw err;
            }
        } else {
            this.logger.info(`Executing command "${command.getCommandString()}". NO_REG_USER.`);
            try {
                command.executeActionNoUser(msg);
            } catch (err) {
                throw err;
            }
        }

    }

    /**
     * Extracts the command name from a message.
     * @param line - The channel message to evaluate.
     * @returns The command string for a command.
     */
    public extractCommand(line: string): string {
        return line.split(" ")[1] ? line.split(" ")[1] : " ";
    }

    /**
     * Extracts the arguments provided for a command.
     * @param line - line - The channel message to evaluate.
     * @param amount - The amount of arguments to extract.
     * @returns A array of arguments for the command.
     */
    public extractArguments(line: string, amount: number): string[] {
        return amount === 0 ?
            line.split(" ").splice(2, line.split(" ").length) :
            line.split(" ").splice(2, amount);
    }

    /**
     * Attempt to invoke the action by testing if the trigger conditions are met.
     * @param id - The discord id of the user invoking the command.
     */
    public async triggerAction(userId: string, msg: OnMessageState): Promise<void> {
        for (const pair of this.commandRegistry.getRegistryMap().entries()) {
            if (pair[1] instanceof TriggerableCommand) {
                const command: TriggerableCommand = pair[1] as TriggerableCommand;
                if (await command.tryTrigger(msg)) {
                    const user = await DBUserSchema.getUserById(userId);
                    try {
                        if (user) {
                            this.logger.info(`Triggering auto command "${command.constructor.name}". NO_WARN.`);
                            command.executeActionNoWarning(msg, user);
                        }
                        else {
                            this.logger.info(`Triggering auto command "${command.constructor.name}". NO_REG_USER.`);
                            command.executeActionNoUser(msg);
                        }
                    } catch (err) {
                        this.logger.verbose(`Auto execution of "${command.constructor.name}"` +
                            `failed, ${err.constructor.name}.`);
                    }
                }
            }
        }
    }

    public getCommandRegistry(): CommandRegistry {
        return this.commandRegistry;
    }

    public getPrefixManager(): PrefixManager {
        return this.prefixManager;
    }

}
