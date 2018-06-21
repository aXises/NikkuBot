import * as Discord from "discord.js";
import { AutoTriggerCommand } from "../command/AutoTriggerCommand";
import { DebugCommand } from "../command/DebugCommand";
import { randInt } from "../utils/Random";
import { FortniteBotAction } from "../action/FortniteBotAction";
import { FortniteBotTrigger } from "../action/FortniteBotTrigger";
import { ExecutableCommand } from "../command/ExecutableCommand";
import { RequireResponseCommand } from "../command/RequireResponseCommand";
import { fortniteBotCore as activeCore } from "../../fortniteBot";
import { PendingResponseState } from "state/PendingResponseState";
import { FortniteBotState } from "state/FortniteBotState";
import { Loop } from "../utils/Loop";
import { User } from "../user/User";
import { getId } from "../utils/CommandUtil";

const sendDefaultText = (state: FortniteBotState): void => {
    const db = activeCore.getDbCore();
    const m: Discord.Message = state.getHandle();
    let targetString = "OwO someone said fortnite? ";
    db.collections.global.get((res) => {
        for (const target of res[0].targets) {
            targetString += "<@!" + target + "> ";
            db.collections.user.incrementCoin(target, "DotmaCoin", 1,
            (c: boolean) => {
                if (!c) {
                    m.reply("DB Error.");
                }
            });
        }
        targetString += " fortnite?";
        m.channel.send(targetString);
    });
};

const fortniteTextEvent = {
    trigger: new FortniteBotTrigger((state) => {
        const m: Discord.Message = state.getHandle();
        return m.content.replace(/\s/g, "").toLowerCase().search("fortnite") !== -1
            && m.content[0] !== "!";
    }),
    action: new FortniteBotAction(1, (state: FortniteBotState) => {
        sendDefaultText(state);
        return true;
    })
};

const pubgTextEvent = {
    trigger: new FortniteBotTrigger((state) => {
        const m: Discord.Message = state.getHandle();
        return m.content.replace(/\s/g, "").toLowerCase().search("pubg") !== -1;
    }),
    action: new FortniteBotAction(1, (state: FortniteBotState) => {
        (state.getHandle() as Discord.Message).channel.send(
            "OwO someone said pubg? (this is a sample)"
        );
        return true;
    })
};

const randomTextEvent = {
    trigger: new FortniteBotTrigger(() => {
        return randInt(0, 100) < 5;
    }),
    action: new FortniteBotAction(1, (state: FortniteBotState) => {
        (state.getHandle() as Discord.Message).channel.send(
            "This message only has a 1/25 chance of appearing"
        );
        return true;
    })
};

const pong = new FortniteBotAction(0, (state: FortniteBotState, args) => {
    (state.getHandle() as Discord.Message).channel.send("pong");
    return true;
});

const pingTargets = new FortniteBotAction(0, (state: FortniteBotState) => {
    sendDefaultText(state);
    return true;
});

const doNothing = new FortniteBotAction(0, (state: FortniteBotState) => {
    return true;
});

const showHelp = new FortniteBotAction(0, (state: FortniteBotState) => {
    (state.getHandle() as Discord.Message).channel.send(
        "``` help response ```"
    );
    return true;
});

const auto = {
    loop: null,
    start: new FortniteBotAction(2, (state: PendingResponseState,
                                     args: any[]) => {
        const m: Discord.Message = state.getHandle();
        const id = m.author.id;
        if (isNaN(args[0]) || isNaN(args[1])) {
            m.channel.send(
                "Usage: !f auto `amount` `delay (seconds)`"
            );
            return;
        }
        if (Number(args[1]) < 1) {
            m.channel.send(
                "Delay must be over 1s"
            );
            return;
        }
        const self = this;
        const db = activeCore.getDbCore();
        db.collections.user.get((res: any[]) => {
            const price = Math.ceil(Math.pow(Number(args[0]), 1.1));
            const index = res.findIndex((user: User) => user.id === id);
            const u = (res[index] as User);
            if (u.currency.DotmaCoin < price) {
                m.reply(
                    "You do not have enough **DotmaCoin** for this operation.\n"
                    + "Operation Cost: **" + price + "**.\n" +
                    "You have: **" + u.currency.DotmaCoin + "**."
                );
                return;
            }
            m.reply("You requested auto pinging, this will cost **" + price +
                " DotmaCoins**.\nStart? " +
                "`yes` or `no`."
            );
            m.channel.awaitMessages(() => {
                return state.updateHandle().author.id === id;
            }, {
                max: 1,
                time: 300000,
                errors: ["time"]
            }).then(() => {
                if (m.content.toLowerCase() === "yes") {
                    db.collections.user.incrementCoin(id, "DotmaCoin", -price,
                    (c: boolean) => {
                        if (!c) {
                            m.channel.send("DB Error.");
                            return;
                        }
                        sendDefaultText(state);
                        self.loop = new Loop(args[0], Number(args[1] * 1000),
                        (amount: number) => {
                            sendDefaultText(state);
                        });
                        self.loop.startLoop();
                        self.looping = true;
                    });

                } else if (m.content.toLowerCase() === "no") {
                    m.channel.send("Okey.");
                }

            }).catch(() => {
                m.reply("Operation cancelled.");
            });
        });
        return true;
    }),
    stop: new FortniteBotAction(0, (state: FortniteBotState) => {
        this.loop.stopLoop();
        return true;
    })
};

const addTarget = new FortniteBotAction(1,
    (state: PendingResponseState, args: string[]) => {
    const m: Discord.Message = state.getHandle();
    const id = getId(args[0]);
    if (args.length !== 1) {
        m.channel.send(
            "Usage:`!f target `@user``."
        );
        return;
    }
    if (!m.guild.client.users.get(id)) {
        m.channel.send(
            "Target must be a user."
        );
        return;
    }
    activeCore.getDbCore().collections.global.get((res: any[]) => {
        if (res[0].targets.indexOf(id) !== -1) {
            m.channel.send("User is already a Target");
            return;
        }
        m.channel.send(args[0] +
            ", Would you like to be added as a target? \n" +
            "`yes` or `no`."
        );
        m.channel.awaitMessages(() => {
            return state.updateHandle().author.id === id;
        }, {
            max: 5,
            time: 300000,
            errors: ["time"]
        }).then(() => {
            if (m.content.toLowerCase() === "yes") {
                m.channel.send("Okey, adding you as a target.");
                activeCore.getDbCore().collections.global.add(id,
                    (c: boolean) => {
                    if (c) {
                        m.channel.send("Added successfully.");
                    } else {
                        m.channel.send("Failed to add as target.");
                    }
                });
            } else if (m.content.toLowerCase() === "no") {
                m.channel.send("Okey.");
            }
        }).catch(() => {
            m.channel.send("User did not respond in time.");
        });
    });
    return true;
});

const getTargetList = new FortniteBotAction(0, (state: FortniteBotState) => {
    activeCore.getDbCore().collections.global.get((res) => {
        const m: Discord.Message = state.getHandle();
        let userlist = "```Current Targets: (" + res[0].targets.length + ")\n";
        for (const id of res[0].targets) {
            if (m.guild.client.users.get(id)) {
                userlist += "- " +
                m.guild.client.users.get(id).username + "\n";
            }
        }
        userlist += "```";
        m.channel.send(userlist);
    });
    return true;
});

const removeTarget = new FortniteBotAction(0, (state: FortniteBotState) => {
    const m: Discord.Message = state.getHandle();
    const id = m.author.id;
    activeCore.getDbCore().collections.global.removeTarget(id, (res) => {
        if (res) {
            m.channel.send("Removed successfully.");
        } else {
            m.channel.send("Failed to remove.");
        }
    });
    return true;
});

export const defaultCommands = [
    new AutoTriggerCommand(0, randomTextEvent.action, randomTextEvent.trigger),
    new AutoTriggerCommand(0, fortniteTextEvent.action, fortniteTextEvent.trigger),
    new AutoTriggerCommand(0, pubgTextEvent.action, pubgTextEvent.trigger),
    new ExecutableCommand("ping", 0, pong),
    new ExecutableCommand(" ", 0, pingTargets),
    new ExecutableCommand("help", 0, showHelp),
    new RequireResponseCommand("auto", 1, auto.start),
    new ExecutableCommand("stop", 0, auto.stop),
    new ExecutableCommand("targetlist", 0, getTargetList),
    new ExecutableCommand("removeself", 0, removeTarget),
    new RequireResponseCommand("target", 0, addTarget)
];
