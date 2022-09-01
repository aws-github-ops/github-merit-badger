import { Badger } from './badger';

export class LeaderboardBadger extends Badger {
  public async runBadgerWorkflow() {
    const username = await this.getGitHubUsername();
    if (this.ignoreThisUsername(username)) {
      console.log(`Detected ${username} in the list of ignored users. Exiting`);
      return;
    }

    const pullRequests = await this.getRelevantPullRequests();
    const badgeIndex = this.determineBadge(pullRequests);
    await this.addLabel(badgeIndex);
    await this.writeComment(badgeIndex, username);
  }

  public determineBadge(_pullRequests: any[]): number {
    console.log('Sorry, this feature has not been implemented yet');
    return 0;
  }
}