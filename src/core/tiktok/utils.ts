export function getUserLevel(user: any): number {

    for (const badge of user?.badges || []) {
        if (
            badge.badgePriorityType === 20 &&
            badge.logExtra?.level
        ) {
            return Number(badge.logExtra.level);
        }
    }

    return 0;
}