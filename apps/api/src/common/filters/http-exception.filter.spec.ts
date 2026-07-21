import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function createHost(url = '/api/test') {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  it('formats HttpException with object response', () => {
    const { host, status, json } = createHost();
    filter.catch(
      new HttpException({ message: 'bad', error: 'Bad Request' }, HttpStatus.BAD_REQUEST),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: 'bad',
        error: 'Bad Request',
        path: '/api/test',
      }),
    );
  });

  it('formats HttpException with string response', () => {
    const { host, json } = createHost();
    filter.catch(new HttpException('Nope', HttpStatus.FORBIDDEN), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Nope', error: 'Nope', statusCode: 403 }),
    );
  });

  it('formats HttpException with array message', () => {
    const { host, json } = createHost();
    filter.catch(
      new HttpException(
        { message: ['a', 'b'], error: 'Validation' },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: ['a', 'b'], error: 'Validation' }),
    );
  });

  it('formats generic Error', () => {
    const { host, json } = createHost();
    filter.catch(new Error('boom'), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'boom',
      }),
    );
  });

  it('formats unknown non-error values', () => {
    const { host, json } = createHost();
    filter.catch('weird', host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });

  it('handles object response without message/error fields', () => {
    const { host, json } = createHost();
    filter.catch(new HttpException({ foo: 1 }, HttpStatus.CONFLICT), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Internal server error',
        error: 'Internal Server Error',
      }),
    );
  });
});
