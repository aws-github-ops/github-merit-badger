import * as core from '@actions/core';
import * as github from '@actions/github';

export interface IRepo {
  owner: string;
  repo: string;
}

export class GithubApi {
  private octokit;
  private repo: IRepo;
  private issueNumber: number | undefined;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
    this.repo = github.context.repo;

    if (github.context.payload.issue) {
      this.issueNumber = github.context.payload.issue.number;
    } else if (github.context.payload.pull_request) {
      this.issueNumber = github.context.payload.pull_request.number;
    } else {
      core.setFailed('Error retrieving issue number');
    }

  }

  public async setPullRequestLabels(labels: string[]) {
    if (!labels.length) return;
    if (this.issueNumber !== undefined) {
      await this.octokit.rest.issues.addLabels({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: this.issueNumber,
        labels,
      });
    }
  }


  public async getIssueNumber() {
    return this.issueNumber;
  }

  public async getPullsData(page: number=1) {
    // head props can be used below to filter PRs based on title(no big change type)
    const response = await this.octokit.rest.pulls.list({
      owner: this.repo.owner,
      repo: this.repo.repo,
      state: 'all',
      per_page: 100,
      page: page,
    });
    return response.data;
  }

  public async getPulls(creatorSpecific: boolean=true) { // issueCreator: string) {
    let result = undefined;
    if (creatorSpecific) {
      const issueCreator = await this.getIssueCreator().catch(error => {
        core.setFailed(error.message);
      });
      if (issueCreator !== undefined) {
        const issues = await this.octokit.paginate(this.octokit.rest.issues.listForRepo, {
          owner: this.repo.owner,
          repo: this.repo.repo,
          state: 'all',
          creator: issueCreator,
        }).catch(error => {core.setFailed(error.message);});
        if (issues !== undefined) {
          result = issues.filter(isPull => isPull.pull_request);
        }
      }
    } else {
      const issues = await this.octokit.paginate(this.octokit.rest.issues.listForRepo, {
        owner: this.repo.owner,
        repo: this.repo.repo,
        state: 'all',
      }).catch(error => {core.setFailed(error.message);});
      if (issues !== undefined) {
        result = issues.filter(isPull => isPull.pull_request);
      }
    }
    console.log('Pulls (in pulls): \n\n');
    console.log(result);
    return result;
  }

  public async getMerges(creatorSpecific: boolean=true) {
    const pulls = await this.getPulls(creatorSpecific).catch(error => {core.setFailed(error.message);});
    console.log('Pulls (in Merges): \n\n');
    console.log(pulls);
    if (pulls !== undefined) {
      const merges = pulls.filter(isMerged => isMerged.pull_request?.merged_at);
      console.log('Merges (in Merges): \n\n');
      console.log(merges);
      return merges;
      //return pulls.filter(isMerged => isMerged.pull_request?.merged_at);
      //const mergedPRs = pulls.filter(isMerged => isMerged.pull_request?.merged_at);
      //return mergedPRs.length;
    }
    return undefined;
    //console.log(`${issueCreator} has made ${numPRs} PRs`);
    //return numPRs;
  }

  public async getRecentMerges(numDays: number, creatorSpecific: boolean=true) {
    let result = undefined;
    const merges = await this.getMerges(creatorSpecific).catch(error => {core.setFailed(error.message);});
    if (merges !== undefined) {
      /*
      const mergeDates = merges.map(mergeDate => mergeDate.pull_request?.merged_at);

      if (mergeDates !== undefined) {
        //const mergedPRs = pulls.filter(isMerged => isMerged.pull_request?.merged_at);
        // return mergedPRs.length; (for testing purpose)
        // get target start date as "startDate" with the given days
        const daysAgo = new Date();
        //const daysAgo = new Date(date.getTime());
        daysAgo.setDate(daysAgo.getDate() - numOfDays);
        //const startDate = daysAgo;

        for (let i = 0; i < mergeDates.length; i += 1) {
          let date = mergeDates[i];
          if (date !== undefined && date !== null) {
            if ( (new Date(date).getDay() - daysAgo.getDay()) >= 0 ) {
              result = result + 1;
            }
          }
        }
      }
      */
      const daysAgo = new Date();
      //const daysAgo = new Date(date.getTime());
      daysAgo.setDate(daysAgo.getDate() - numDays);
      //const startDate = daysAgo;

      /*
      for (let i = 0; i < merges.length; i += 1) {
        let date = merges[i].pull_request?.merged_at;
        if (date !== undefined && date !== null) {
          if ( (new Date(date).getDay() - daysAgo.getDay()) >= 0 ) {
            //result = result + 1;
          }
        }
      }
      */

      result = merges.filter(recent => (recent.pull_request?.merged_at !== null)
        && (recent.pull_request?.merged_at !== undefined)
        && (this.compareDate(new Date(recent.pull_request?.merged_at), numDays)));
    }
    console.log('Recent Merges (in Recent): \n\n');
    console.log(result);
    return result;
    //console.log(`${issueCreator} has made ${numPRs} PRs`);
    //return numPRs;
  }

  private compareDate(date: Date, numDays: number) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - numDays);
    return (new Date(date).getDay() - daysAgo.getDay()) >= 0;
  }

  public async getIssueCreator() {
    if (this.issueNumber !== undefined) {
      const { data } = await this.octokit.rest.issues.get({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: this.issueNumber,
      });
      return data.user?.login;
    } else {return undefined;}
  }

  public async writePRComments(comment: string) {
    if (this.issueNumber !== undefined) {
      await this.octokit.rest.issues.createComment({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: this.issueNumber,
        body: comment,
      });
    }
  }

  public async getFixesAndFeats() {
    //const pulls = await this.getPulls().catch(error => {
    const merges = await this.getMerges().catch(error => {
      core.setFailed(error.message);
    });

    if (merges !== undefined) {
      //const titles = pulls.filter(isMerged => isMerged.pull_request.merged_at).map(title => title.title).filter();
      const titles = merges.map(title => title.title);
      return titles.filter(key => key.slice(0, this.getIndex(key)) === 'fix' || key.slice(0, this.getIndex(key)) === 'feat');
    }
    return undefined;
  }

  // helper function for getFixesAndFeats
  private getIndex(key: string) {
    const indexColon = key.indexOf(':');
    const indexParens = key.indexOf('(');

    if (indexColon === -1) {
      return 0;
    }
    if (indexParens === -1) {
      return indexColon;
    }

    return indexColon < indexParens ? indexColon : indexParens;
  }
}
