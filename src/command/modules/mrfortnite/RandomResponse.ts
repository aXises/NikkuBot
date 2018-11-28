import * as Discord from "discord.js";
import TriggerableCommand from "command/TriggerableCommand";
import AccessLevel from "user/AccessLevel";
import Trigger from "action/Trigger";
import Action from "action/Action";
import OnMessageState from "state/OnMessageState";
import randInt from "utils/Random";
import Config from "config/Config";
import ChatBotService from "services/ChatBotService";

export default class RandomResponse extends TriggerableCommand {

    private botService: ChatBotService;

    public constructor() {
        super(AccessLevel.UNREGISTERED);
        this.botService = new ChatBotService(Config);
    }

    public setCustomTrigger(): Trigger {
        return new Trigger(async (state: OnMessageState) => {
            return randInt(0, 100) < 5;
        });
    }

    public setCustomAction(): Action {
        return new Action(async (state: OnMessageState) => {
            const m: Discord.Message = state.getMessageHandle();
            if (m.content.replace(/\s/g, "").toLowerCase().startsWith("mrfortnite")) {
                m.content = m.content.substring("Mr Fortnite ".length);
            }
            try {
                await this.botService.sendMessage(m.content, m.channel as Discord.TextChannel);
                return true;
            } catch (err) {
                throw err;
            }
        });
    }
}
