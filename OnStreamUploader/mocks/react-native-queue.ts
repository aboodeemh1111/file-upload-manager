// Simple mock implementation of react-native-queue
export default {
  async createQueue() {
    return {
      addWorker: (name: string, concurrency: number, worker: Function) => {
        console.log(`Added worker: ${name} with concurrency ${concurrency}`);
      },
      createJob: (name: string, payload: any, options: any) => {
        console.log(`Created job: ${name}`);
        return {
          save: async () => {
            console.log(`Saved job: ${name}`);
            return Promise.resolve();
          },
        };
      },
    };
  },
};
